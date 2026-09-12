(() => {
"use strict";

const CONFIG = window.KEYS99_CONFIG || {};
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Keys99 configuration is missing.");
}

const db = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const feed = document.getElementById("reelsFeed");
const loading = document.getElementById("loading");
const emptyState = document.getElementById("emptyState");
const toast = document.getElementById("toast");

let reels = [];
let observer = null;
let currentUser = null;
let toastTimer = null;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

const formatCount = n => {
    n = Number(n || 0);
    if (n >= 10000000) return (n / 10000000).toFixed(n % 10000000 ? 1 : 0) + "Cr";
    if (n >= 100000) return (n / 100000).toFixed(n % 100000 ? 1 : 0) + "L";
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + "K";
    return String(n);
};

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function firstImage(property) {
    return property?.main_image || property?.interior?.[0] || property?.exterior?.[0] || "";
}

function getTitle(property) {
    const options = Array.isArray(property?.bhk_options) ? property.bhk_options : [];
    const first = options[0];
    const bhk = typeof first === "object" ? (first.bhk || first.type || "") : "";
    return property?.property_name || property?.project_name ||
           (bhk ? `${bhk} Property` : "Featured Property");
}

function getLocation(property) {
    return [property?.locality, property?.city].filter(Boolean).join(", ") ||
           property?.address || "Location available on request";
}

function getConfigs(property) {
    const raw = Array.isArray(property?.bhk_options) ? property.bhk_options : [];
    return raw.slice(0, 4).map(x => {
        if (typeof x === "string") return {bhk:x, price:""};
        return {
            bhk: x?.bhk || x?.type || x?.name || "",
            price: x?.price || x?.starting_price || x?.amount || ""
        };
    }).filter(x => x.bhk);
}

function mediaUrl(reel) {
    return reel.video_url || reel.video || reel.virtual_tour_video ||
           reel.property?.virtual_tour_video || "";
}

function validVideo(url) {
    return /^https?:\/\//i.test(url || "");
}

function youtubeEmbed(url) {
    try {
        const u = new URL(url);
        let id = u.searchParams.get("v");
        if (!id && u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
        if (!id) {
            const match = u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/);
            id = match?.[1];
        }
        return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${id}` : "";
    } catch { return ""; }
}

function isYoutube(url) {
    return /youtube\.com|youtu\.be/i.test(url || "");
}

function renderReel(reel, index) {
    const p = reel.property || {};
    const video = mediaUrl(reel);
    const configs = getConfigs(p);
    const image = firstImage(p);
    const youtube = isYoutube(video) ? youtubeEmbed(video) : "";

    const videoMarkup = youtube
        ? `<iframe class="reel-video" src="${escapeHtml(youtube)}" title="Property video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
        : `<video class="reel-video" src="${escapeHtml(video)}" ${image ? `poster="${escapeHtml(image)}"` : ""} playsinline loop muted preload="metadata"></video>`;

    const configMarkup = configs.length
        ? `<div class="config-strip">${configs.map(c => `
            <div class="config">
                <strong>${escapeHtml(c.bhk)}</strong>
                <span>${escapeHtml(c.price || "Price on request")}</span>
            </div>`).join("")}</div>`
        : "";

    const likes = Number(reel.likes_count || 0);
    const views = Number(reel.views_count || 0);
    const comments = Number(reel.comments_count || 0);

    const article = document.createElement("article");
    article.className = "reel";
    article.dataset.index = index;
    article.dataset.id = reel.id;
    article.innerHTML = `
        ${videoMarkup}

        <div class="reel-top">
            <div class="reel-label"><i></i> PROPERTY REEL</div>
        </div>

        <button class="round-btn mute-btn" data-action="mute" aria-label="Mute or unmute">🔇</button>

        <div class="reel-actions">
            <button class="action like-action ${reel.liked ? "active" : ""}" data-action="like">
                <span class="action-icon">${reel.liked ? "♥" : "♡"}</span>
                <span class="action-label like-count">${formatCount(likes)}</span>
            </button>
            <button class="action" data-action="comments">
                <span class="action-icon">💬</span>
                <span class="action-label">${formatCount(comments)}</span>
            </button>
            <button class="action">
                <span class="action-icon">◉</span>
                <span class="action-label">${formatCount(views)}</span>
            </button>
            <button class="action" data-action="share">
                <span class="action-icon">↗</span>
                <span class="action-label">Share</span>
            </button>
        </div>

        <div class="reel-info">
            <div class="property-row">
                <img class="property-avatar" src="${escapeHtml(image)}" alt="">
                <div>
                    <div class="property-name">${escapeHtml(getTitle(p))}</div>
                    <div class="property-meta">⌖ ${escapeHtml(getLocation(p))}${p.developer ? ` · ${escapeHtml(p.developer)}` : ""}</div>
                </div>
            </div>

            ${reel.caption ? `<div class="caption">${escapeHtml(reel.caption)}</div>` :
              p.overview ? `<div class="caption">${escapeHtml(p.overview)}</div>` : ""}

            ${configMarkup}

            <div class="bottom-buttons">
                <button class="bottom-btn detail-btn" data-action="detail">▦ &nbsp; View Detail</button>
                <button class="bottom-btn tour-btn" data-action="tour">▣ &nbsp; Tour</button>
            </div>
        </div>

        <div class="video-progress"><span></span></div>
    `;

    return article;
}

async function loadReels() {
    if (!db) {
        loading.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }

    loading.classList.remove("hidden");
    emptyState.classList.add("hidden");
    feed.innerHTML = "";

    try {
        // Videos are fetched DIRECTLY from public.properties.virtual_tour_video.
        // No property_reels table is required for the video source.
        const { data, error } = await db
            .from("properties")
            .select(`
                id,
                developer,
                address,
                city,
                locality,
                state,
                pincode,
                main_image,
                interior,
                exterior,
                bhk_options,
                overview,
                virtual_tour_video,
                contact_number
            `)
            .not("virtual_tour_video", "is", null)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Remove empty strings as well as null values.
        const properties = (data || []).filter(property =>
            validVideo(property.virtual_tour_video)
        );

        const ids = properties.map(p => p.id);
        let statsById = {};
        let likedIds = new Set();

        if (ids.length) {
            const { data: stats, error: statsError } = await db
                .from("property_reel_stats")
                .select("property_id, likes_count, views_count, comments_count")
                .in("property_id", ids);
            if (statsError) throw statsError;
            (stats || []).forEach(row => { statsById[row.property_id] = row; });

            if (currentUser) {
                const { data: likes, error: likesError } = await db
                    .from("property_reel_likes")
                    .select("property_id")
                    .eq("user_id", currentUser.id)
                    .in("property_id", ids);
                if (likesError) throw likesError;
                likedIds = new Set((likes || []).map(row => row.property_id));
            }
        }

        // Convert each property into the reel object expected by the UI.
        reels = properties.map(property => {
            const stats = statsById[property.id] || {};
            return {
                id: property.id,
                property_id: property.id,
                video_url: property.virtual_tour_video,
                caption: property.overview || "",
                likes_count: Number(stats.likes_count || 0),
                views_count: Number(stats.views_count || 0),
                comments_count: Number(stats.comments_count || 0),
                liked: likedIds.has(property.id),
                property
            };
        });

        if (!reels.length) {
            emptyState.classList.remove("hidden");
            loading.classList.add("hidden");
            return;
        }

        reels.forEach((reel, i) => feed.appendChild(renderReel(reel, i)));
        setupInteractions();
        setupObserver();

        loading.classList.add("hidden");
    } catch (error) {
        console.error("Keys99 reels error:", error);
        loading.classList.add("hidden");
        emptyState.classList.remove("hidden");
        showToast(error.message || "Unable to load property videos.");
    }
}

function setupObserver() {
    observer?.disconnect();

    observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const video = entry.target.querySelector("video");
            if (!video) return;

            if (entry.isIntersecting && entry.intersectionRatio > .65) {
                document.querySelectorAll(".reel video").forEach(v => {
                    if (v !== video) v.pause();
                });
                video.play().catch(() => {});
                incrementView(entry.target.dataset.id);
            } else {
                video.pause();
            }
        });
    }, { threshold:[.65] });

    document.querySelectorAll(".reel").forEach(reel => observer.observe(reel));
}

async function incrementView(id) {
    const key = `keys99_viewed_${id}`;
    if (sessionStorage.getItem(key)) return;

    const reel = reels.find(r => r.id === id);
    if (!reel || !db) return;

    const sessionKey = "keys99_reel_session_id";
    let sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
        sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(sessionKey, sessionId);
    }

    const { data, error } = await db.rpc("record_property_reel_view", {
        p_property_id: id,
        p_session_id: sessionId
    });

    if (error) {
        console.error("View tracking error:", error);
        return;
    }

    sessionStorage.setItem(key, "1");

    if (typeof data === "number") reel.views_count = data;
    else reel.views_count = Number(reel.views_count || 0) + 1;

    const article = document.querySelector(`.reel[data-id="${CSS.escape(id)}"]`);
    const action = article?.querySelector(".reel-actions .action:nth-child(3) .action-label");
    if (action) action.textContent = formatCount(reel.views_count);
}

async function toggleLike(reel, article, button) {
    if (!db) return;

    if (!currentUser) {
        showToast("Please login to like this reel.");
        return;
    }

    button.disabled = true;
    try {
        if (reel.liked) {
            const { error } = await db
                .from("property_reel_likes")
                .delete()
                .eq("property_id", reel.property_id)
                .eq("user_id", currentUser.id);
            if (error) throw error;
            reel.liked = false;
        } else {
            const { error } = await db
                .from("property_reel_likes")
                .insert({ property_id: reel.property_id, user_id: currentUser.id });
            if (error) throw error;
            reel.liked = true;
        }

        const { data: stats, error: statsError } = await db
            .from("property_reel_stats")
            .select("likes_count")
            .eq("property_id", reel.property_id)
            .maybeSingle();
        if (statsError) throw statsError;

        reel.likes_count = Number(stats?.likes_count || 0);
        button.classList.toggle("active", reel.liked);
        button.querySelector(".action-icon").textContent = reel.liked ? "♥" : "♡";
        button.querySelector(".like-count").textContent = formatCount(reel.likes_count);
    } catch (error) {
        console.error(error);
        showToast("Unable to update like.");
    } finally {
        button.disabled = false;
    }
}

async function openComments(reel) {
    const sheet = document.createElement("div");
    sheet.className = "comments-sheet";
    sheet.innerHTML = `
        <div class="sheet-handle"></div>
        <div class="sheet-head">
            <h3>Comments</h3>
            <button class="sheet-close">×</button>
        </div>
        <div class="comments-list"><p>Loading comments...</p></div>
        <form class="comment-form">
            <input name="comment" placeholder="Write a comment..." maxlength="500" required>
            <button>Post</button>
        </form>
    `;
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add("open"));

    const close = () => {
        sheet.classList.remove("open");
        setTimeout(() => sheet.remove(), 300);
    };
    sheet.querySelector(".sheet-close").onclick = close;

    const list = sheet.querySelector(".comments-list");

    try {
        const {data, error} = await db
            .from("property_reel_comments")
            .select("id, comment, created_at, user_id")
            .eq("property_id", reel.property_id)
            .order("created_at", {ascending:false});

        if (error) throw error;

        list.innerHTML = data?.length ? data.map(c => `
            <div class="comment">
                <strong>User</strong>
                <p>${escapeHtml(c.comment)}</p>
            </div>`).join("") : "<p>No comments yet.</p>";
    } catch (e) {
        list.innerHTML = "<p>Comments could not be loaded.</p>";
        console.error(e);
    }

    sheet.querySelector(".comment-form").addEventListener("submit", async e => {
        e.preventDefault();

        if (!currentUser) {
            showToast("Please login to comment.");
            return;
        }

        const input = e.target.comment;
        const text = input.value.trim();
        if (!text) return;

        const {error} = await db.from("property_reel_comments").insert({
            property_id: reel.property_id,
            user_id: currentUser.id,
            comment: text
        });

        if (error) {
            showToast("Unable to post comment.");
            return;
        }

        input.value = "";
        const { data: stats, error: statsError } = await db
            .from("property_reel_stats")
            .select("comments_count")
            .eq("property_id", reel.property_id)
            .maybeSingle();
        if (!statsError) reel.comments_count = Number(stats?.comments_count || 0);

        list.insertAdjacentHTML("afterbegin", `
            <div class="comment">
                <strong>You</strong>
                <p>${escapeHtml(text)}</p>
            </div>
        `);

        const article = document.querySelector(`.reel[data-id="${CSS.escape(reel.id)}"]`);
        const label = article?.querySelector(".reel-actions .action:nth-child(2) .action-label");
        if (label) label.textContent = formatCount(reel.comments_count);
    });
}

function setupInteractions() {
    feed.addEventListener("click", async e => {
        const action = e.target.closest("[data-action]");
        if (!action) {
            const video = e.target.closest("video");
            if (video) {
                if (video.paused) video.play().catch(()=>{});
                else video.pause();
            }
            return;
        }

        const article = e.target.closest(".reel");
        const reel = reels[Number(article.dataset.index)];
        const type = action.dataset.action;

        if (type === "mute") {
            const video = article.querySelector("video");
            if (!video) return;
            video.muted = !video.muted;
            action.textContent = video.muted ? "🔇" : "🔊";
        }

        if (type === "like") await toggleLike(reel, article, action);

        if (type === "comments") await openComments(reel);

        if (type === "share") {
            const url = `${location.origin}${location.pathname}?reel=${encodeURIComponent(reel.id)}`;
            if (navigator.share) {
                try { await navigator.share({title:getTitle(reel.property), url}); } catch {}
            } else {
                await navigator.clipboard?.writeText(url);
                showToast("Reel link copied.");
            }
        }

        if (type === "detail") {
            location.href = `property-details.html?id=${encodeURIComponent(reel.property_id)}`;
        }

        if (type === "tour") {
            const url = reel.property?.virtual_tour_video || reel.video_url;
            if (url) window.open(url, "_blank", "noopener");
            else showToast("Tour is not available.");
        }
    });

    document.querySelectorAll(".reel video").forEach(video => {
        video.addEventListener("timeupdate", () => {
            const reel = video.closest(".reel");
            const progress = reel.querySelector(".video-progress span");
            if (video.duration) progress.style.width = `${(video.currentTime / video.duration) * 100}%`;
        });
    });
}

async function initAuth() {
    if (!db) return;

    const {data} = await db.auth.getUser();
    currentUser = data?.user || null;

    db.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
    });
}

document.getElementById("backBtn").onclick = () => {
    if (history.length > 1) history.back();
    else location.href = "index.html";
};
document.getElementById("refreshBtn").onclick = loadReels;
document.getElementById("retryBtn").onclick = loadReels;

initAuth().then(loadReels);
})();
