"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useUI } from "@/components/UIProvider";
import { useRefresh } from "@/components/RefreshProvider";
import ConfirmModal from "@/components/ConfirmModal";
import { timeAgo } from "@/lib/timeAgo";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const IMAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/question-images/`;

export default function CommunityPage() {
  const { user, profile, isAdmin } = useAuth();
  const { showLoading, hideLoading, showToast } = useUI();
  const { registerHandler } = useRefresh();

  const [posts, setPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [comments, setComments] = useState({});
  const [drafts, setDrafts] = useState({});
  const [kinds, setKinds] = useState({});
  const [showNew, setShowNew] = useState(false);
  const [newText, setNewText] = useState("");
  const [newImage, setNewImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: "post" | "comment", item }
  const openIdRef = useRef(null);
  openIdRef.current = openId;

  const loadComments = useCallback(async (postId) => {
    const { data } = await supabase.from("community_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    setComments((prev) => ({ ...prev, [postId]: data || [] }));
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("community_posts")
      .select("*, community_comments(count)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setPosts(data || []);
    setLoaded(true);
    if (openIdRef.current) loadComments(openIdRef.current);
  }, [loadComments]);

  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => registerHandler(loadPosts), [registerHandler, loadPosts]);

  function toggleOpen(postId) {
    if (openId === postId) { setOpenId(null); return; }
    setOpenId(postId);
    loadComments(postId);
  }

  async function handleNewPost(e) {
    e.preventDefault();
    const text = newText.trim();
    if (submitting || !text) return;
    if (newImage && (!newImage.type.startsWith("image/") || newImage.size > 5 * 1024 * 1024)) {
      showToast("اختر صورة بحجم أقل من 5 ميجا.", "error");
      return;
    }
    setSubmitting(true);
    showLoading();
    try {
      let imageUrl = null;
      if (newImage) {
        const ext = (newImage.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${user.id}/community-${Date.now()}.${ext || "jpg"}`;
        const { error: upErr } = await supabase.storage.from("question-images").upload(path, newImage);
        if (upErr) throw upErr;
        imageUrl = supabase.storage.from("question-images").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id,
        author_name: profile?.name || "مستخدم",
        question: text,
        image_url: imageUrl,
      });
      if (error) throw error;
      showToast("تم نشر سؤالك في المجتمع.", "success");
      setShowNew(false); setNewText(""); setNewImage(null);
      loadPosts();
    } catch {
      showToast("تعذّر نشر السؤال. حاول مرة أخرى.", "error");
    } finally {
      hideLoading();
      setSubmitting(false);
    }
  }

  async function handleAddComment(post) {
    const text = (drafts[post.id] || "").trim();
    if (!text) return;
    const kind = kinds[post.id] || "comment";
    const { error } = await supabase.from("community_comments").insert({
      post_id: post.id, user_id: user.id, author_name: profile?.name || "مستخدم", kind, content: text,
    });
    if (error) { showToast("تعذّر إرسال ردك.", "error"); return; }
    setDrafts((d) => ({ ...d, [post.id]: "" }));
    loadComments(post.id);
    loadPosts();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const { type, item } = confirmDelete;
    const table = type === "post" ? "community_posts" : "community_comments";
    let query = supabase.from(table).delete().eq("id", item.id);
    if (!(isAdmin && item.user_id !== user.id)) query = query.eq("user_id", user.id);
    const { error } = await query;
    setConfirmDelete(null);
    if (error) { showToast("تعذّر الحذف.", "error"); return; }
    showToast("تم الحذف.", "success");
    if (type === "post" && openId === item.id) setOpenId(null);
    loadPosts();
  }

  async function handleReport(type, item) {
    const row = { user_id: user.id, ...(type === "post" ? { post_id: item.id } : { comment_id: item.id }) };
    const { error } = await supabase.from("community_reports").insert(row);
    if (error) { showToast("تعذّر إرسال البلاغ.", "error"); return; }
    showToast("تم إرسال البلاغ، شكرًا لك.", "success");
  }

  return (
    <>
      <div className="section-header">
        <h3>👥 المجتمع</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>+ اسأل المجتمع</button>
      </div>
      <p className="community-intro">شارك أسئلتك مع الجميع، وجاوب على أسئلة غيرك. كن لطيفًا ومحترمًا.</p>

      {loaded && posts.length === 0 && <div className="empty-state">لا توجد أسئلة بعد. كن أول من يشارك!</div>}

      <div className="community-list">
        {posts.map((p) => {
          const count = p.community_comments?.[0]?.count || 0;
          const isOpen = openId === p.id;
          const mine = p.user_id === user?.id;
          const list = comments[p.id] || [];
          const safeImage = p.image_url && p.image_url.startsWith(IMAGE_PREFIX) ? p.image_url : null;
          return (
            <article key={p.id} className="post-card">
              <header className="post-head">
                <span className="post-avatar">{(p.author_name || "؟").trim().charAt(0)}</span>
                <div className="post-author">
                  <b>{p.author_name}</b>
                  <small>{timeAgo(p.created_at)}</small>
                </div>
                <div className="post-tools">
                  {(mine || isAdmin)
                    ? <button type="button" title={mine ? "حذف" : "حذف (أدمن)"} onClick={() => setConfirmDelete({ type: "post", item: p })}>🗑️</button>
                    : <button type="button" title="إبلاغ" onClick={() => handleReport("post", p)}>🚩</button>}
                </div>
              </header>
              <div className="post-text">{p.question}</div>
              {safeImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="post-image" src={safeImage} alt="صورة السؤال" loading="lazy" />
              )}
              <button type="button" className="post-toggle" onClick={() => toggleOpen(p.id)}>
                💬 {count} {count === 1 ? "رد" : "ردود"} {isOpen ? "▲" : "▼"}
              </button>

              {isOpen && (
                <div className="comments-box">
                  {list.length === 0 && <div className="comments-empty">لا توجد ردود بعد. شارك برأيك أو إجابتك.</div>}
                  {list.map((c) => (
                    <div key={c.id} className={"comment" + (c.kind === "answer" ? " is-answer" : "")}>
                      <div className="comment-head">
                        <b>{c.author_name}</b>
                        {c.kind === "answer" && <span className="badge accent">إجابة</span>}
                        <small>{timeAgo(c.created_at)}</small>
                        <span className="comment-tools">
                          {(c.user_id === user?.id || isAdmin)
                            ? <button type="button" title="حذف" onClick={() => setConfirmDelete({ type: "comment", item: c })}>🗑️</button>
                            : <button type="button" title="إبلاغ" onClick={() => handleReport("comment", c)}>🚩</button>}
                        </span>
                      </div>
                      <div className="comment-text">{c.content}</div>
                    </div>
                  ))}

                  <div className="comment-form">
                    <div className="kind-toggle">
                      <button type="button" className={(kinds[p.id] || "comment") === "comment" ? "active" : ""} onClick={() => setKinds((k) => ({ ...k, [p.id]: "comment" }))}>تعليق</button>
                      <button type="button" className={kinds[p.id] === "answer" ? "active" : ""} onClick={() => setKinds((k) => ({ ...k, [p.id]: "answer" }))}>إجابة</button>
                    </div>
                    <textarea
                      value={drafts[p.id] || ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      placeholder={kinds[p.id] === "answer" ? "اكتب إجابتك..." : "اكتب تعليقك..."}
                      maxLength={2000}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddComment(p)} disabled={!(drafts[p.id] || "").trim()}>إرسال</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>اسأل المجتمع</h3>
            <form onSubmit={handleNewPost}>
              <div className="field">
                <label>سؤالك</label>
                <textarea style={{ minHeight: 130 }} value={newText} onChange={(e) => setNewText(e.target.value)} maxLength={3000} required autoFocus />
              </div>
              <div className="field">
                <label>صورة (اختياري)</label>
                <input type="file" accept="image/*" onChange={(e) => setNewImage(e.target.files?.[0] || null)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>نشر</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete.type === "post" ? "حذف السؤال" : "حذف الرد"}
          message={confirmDelete.type === "post" ? "سيُحذف السؤال وكل الردود عليه. هل أنت متأكد؟" : "هل تريد حذف هذا الرد؟"}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
