/* ==========================================================
   KEYS99 PROPERTY DETAILS
   URL: property-details.html?id=<SUPABASE_PROPERTY_ID>

   Current properties schema used here:
   id, developer, address, state, city, locality, pincode,
   status, "possession date", overview, main_image,
   bhk_options, amenities, nearby_landmarks, interior, exterior,
   rera_id, contact_number, youtube_link, facebook_link,
   instagram_link, posted_by_user_id, posted_by_user_code,
   posted_by_name, virtual_tour_video
   ========================================================== */

/* ==========================================================
   KEYS99 PROPERTY DETAILS
========================================================== */
const SUPABASE_URL =
  "https://xeesusgbdyrgxvzevjha.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlZXN1c2diZHlyZ3h2emV2amhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NzI1MzksImV4cCI6MjA4ODQ0ODUzOX0.8TjnH50MO4YBu8liCJwnUu36hiX6zAwRpGOCPFVW7sI";




const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const propertyId = new URLSearchParams(window.location.search).get("id");

let property = null;
let galleryImages = [];
let currentImage = 0;

const $ = id => document.getElementById(id);




/* ---------------- HELPERS ---------------- */
function value(...values){
  for(const v of values){
    if(v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "—";
}

function arrayValue(v){
  if(v === undefined || v === null || v === "") return [];
  if(Array.isArray(v)) return v;
  if(typeof v === "object") return [v];
  if(typeof v === "string"){
    try{
      const parsed = JSON.parse(v);
      if(Array.isArray(parsed)) return parsed;
      if(parsed && typeof parsed === "object") return [parsed];
    }catch(_){ }
    return v.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
  }
  return [];
}

function textFrom(item,...keys){
  if(typeof item === "string") return item;
  if(item && typeof item === "object") return value(...keys.map(k => item[k]));
  return "—";
}

function formatPrice(v){
  if(v === undefined || v === null || String(v).trim() === "") return "Price on Request";
  const s = String(v).trim();
  if(/₹|lakh|lac|crore|cr|onwards|month|sq/i.test(s)) return s;
  const n = Number(s.replace(/,/g,""));
  return Number.isFinite(n) ? "₹ " + n.toLocaleString("en-IN") : s;
}

function formatArea(v){
  if(v === undefined || v === null || String(v).trim() === "") return "—";
  const s = String(v).trim();
  return /sq\.?\s*ft|sqft|square feet/i.test(s) ? s : `${s} sq.ft.`;
}

function escapeHtml(v){
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function escapeAttr(v){ return escapeHtml(v); }

function getBhkOptions(p){
  const raw = p?.bhk_options;
  if(raw === undefined || raw === null || raw === "") return [];

  // Supports JSONB arrays as well as an object/map such as:
  // {"1 BHK":{"price":"45 L","carpet_area":"450 sq.ft"}}
  if(Array.isArray(raw)) return raw;

  if(typeof raw === "object") {
    return Object.entries(raw).map(([key,val]) => {
      if(val && typeof val === "object" && !Array.isArray(val)) {
        return { ...val, type: val.type || val.bhk || val.bhk_type || key };
      }
      return { type:key, price:val };
    });
  }

  if(typeof raw === "string") {
    try {
      return getBhkOptions({bhk_options:JSON.parse(raw)});
    } catch(_) {
      return raw.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean).map(x => ({type:x}));
    }
  }
  return [];
}

function getBhkLabel(item){
  if(typeof item === "string") return item;
  return value(item?.type,item?.bhk,item?.bhk_type,item?.configuration,item?.name,"—");
}

function getBhkPrice(item){
  if(typeof item === "string") return "";
  return value(item?.price,item?.starting_price,item?.price_from,item?.min_price,"");
}

function getBhkArea(item){
  if(typeof item === "string") return "";
  return value(item?.area,item?.carpet_area,item?.carpet_area_sqft,item?.sqft,item?.area_sqft,"");
}

function priceToRupees(v){
  if(v === undefined || v === null || v === "") return NaN;
  const s = String(v).toLowerCase().replace(/,/g, "").trim();
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if(!Number.isFinite(n)) return NaN;
  if(/crore|cr\b/.test(s)) return n * 10000000;
  if(/lakh|lac\b|l\b/.test(s)) return n * 100000;
  if(/k\b/.test(s)) return n * 1000;
  return n;
}

function getPropertyTitle(p){
  const locality = value(p.locality,p.address,p.city,"Property");
  const city = value(p.city," ");
  if(locality !== "Property" && city !== "—" && String(locality).toLowerCase() !== String(city).toLowerCase()){
    return `Property in ${locality}, ${city}`;
  }
  if(locality !== "Property") return `Property in ${locality}`;
  return "Property";
}

function getLocation(p){
  return [p.locality,p.city,p.state,p.pincode].filter(v => v !== undefined && v !== null && String(v).trim() !== "").join(", ");
}

function getImages(p){
  const result = [];

  const add = item => {
    if(!item) return;
    if(Array.isArray(item)){
      item.forEach(add);
      return;
    }
    if(typeof item === "string"){
      arrayValue(item).forEach(x => {
        if(typeof x === "string") result.push(x);
        else if(x?.url || x?.image_url || x?.src) result.push(x.url || x.image_url || x.src);
      });
      return;
    }
    if(typeof item === "object"){
      const url = item.url || item.image_url || item.src || item.path;
      if(url) result.push(url);
    }
  };

  /* Exact current schema: main_image + interior[] + exterior[]. */
  add(p.main_image);
  add(p.interior);
  add(p.exterior);

  /* Compatibility with older records if any exist. */
  add(p.images); add(p.image_urls); add(p.gallery); add(p.photos); add(p.property_images);

  return [...new Set(result.map(x => String(x).trim()).filter(Boolean))];
}

function directVideoUrls(v){
  return arrayValue(v).filter(Boolean).map(x => typeof x === "string" ? x : x?.url || x?.video_url || x?.src).filter(Boolean);
}

function isDirectVideo(url){
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url) || /supabase\.co\/storage\/v1\/object\/public\//i.test(url);
}

/* ---------------- LOAD ---------------- */
async function loadProperty(){
  if(!propertyId){ showError("No property ID was supplied."); return; }

  try{
    const {data,error} = await db.from("properties").select("*").eq("id",propertyId).single();
    if(error) throw error;
    if(!data) throw new Error("Property not found.");
    property = data;
    renderProperty(data);
  }catch(error){
    console.error("Keys99 property error:",error);
    showError(error?.message || "Unable to load property details.");
  }
}

/* ---------------- RENDER PROPERTY ---------------- */
function renderProperty(p){
  const name = getPropertyTitle(p);
  const bhks = getBhkOptions(p);
  const bhkLabels = [...new Set(bhks.map(getBhkLabel).filter(x => x && x !== "—"))];
  const developer = value(p.developer,p.posted_by_name,"—");
  const location = getLocation(p);
  const status = value(p.status,"For Sale");
  const type = bhks.length ? "Residential" : "Property";

  const prices = bhks.map(getBhkPrice).filter(x => x !== "" && x !== "—");
  const numericPrices = prices.map(priceToRupees).filter(Number.isFinite);
  const startingPrice = numericPrices.length ? Math.min(...numericPrices) : (prices[0] || null);
  const firstArea = bhks.length ? getBhkArea(bhks[0]) : "";

  $("propertyName").textContent = name;
  $("crumbName").textContent = name;
  $("miniBreadcrumb").textContent = type;
  $("propertyType").textContent = type;
  $("developer").textContent = developer;
  $("developerName").textContent = developer;
  $("propertyLocation").textContent = "⌖ " + (location || "Location not available");
  $("mapLocation").textContent = location || "Property Location";
  $("statusBadge").textContent = status;
  $("propertyPrice").textContent = formatPrice(startingPrice);
  $("bhk").textContent = bhkLabels.length ? bhkLabels.join(" / ") : "—";
  $("carpetArea").textContent = firstArea ? formatArea(firstArea) : "—";
  $("possession").textContent = value(p["possession date"],p.possession,p.possession_date,"—");
  $("description").textContent = value(p.overview,p.description,p.about,"Property description is not available.");
  $("developerDescription").textContent = "";
  document.title = `${name} | Keys99.com`;

  renderGallery(p);
  renderConfigurations(p);
  renderAmenities(p);
  renderLocationAdvantages(p);
  renderMedia(p);
  populateEnquiry(p,bhkLabels,developer,name);
  $("whatsappBtn").classList.toggle("hidden", !p.contact_number);
  setupMap(p,location);

  $("loading").classList.add("hidden");
  $("propertyPage").classList.remove("hidden");
}

/* ---------------- GALLERY ---------------- */
function renderGallery(p){
  galleryImages = getImages(p);
  currentImage = 0;

  const thumbs = $("galleryThumbs");
  thumbs.innerHTML = "";
  $("photoCount")?.remove();

  if(!galleryImages.length){
    $("mainPhoto").classList.add("no-image");
    $("mainImage").alt = "No property image available";
    $("prevImage").classList.add("hidden");
    $("nextImage").classList.add("hidden");
    return;
  }

  galleryImages.forEach((url,index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-thumb" + (index === 0 ? " active" : "");
    button.setAttribute("aria-label",`View property image ${index + 1}`);
    button.innerHTML = `<img src="${escapeAttr(url)}" alt="Property image ${index + 1}" loading="lazy">`;
    button.addEventListener("click",() => {
      currentImage = index;
      updateGallery();
      openLightbox(index);
    });
    thumbs.appendChild(button);
  });

  updateGallery();
  const onlyOne = galleryImages.length < 2;
  $("prevImage").disabled = onlyOne;
  $("nextImage").disabled = onlyOne;
}

function updateGallery(){
  if(!galleryImages.length) return;
  const url = galleryImages[currentImage];
  $("mainImage").src = url;
  $("mainImage").alt = `Property image ${currentImage + 1}`;
  document.querySelectorAll(".gallery-thumb").forEach((el,i) => el.classList.toggle("active",i === currentImage));
  const activeThumb = document.querySelectorAll(".gallery-thumb")[currentImage];
  activeThumb?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
}

function nextGallery(step){
  if(galleryImages.length < 2) return;
  currentImage = (currentImage + step + galleryImages.length) % galleryImages.length;
  updateGallery();
}

$("prevImage").addEventListener("click",e => { e.stopPropagation(); nextGallery(-1); });
$("nextImage").addEventListener("click",e => { e.stopPropagation(); nextGallery(1); });
$("mainPhoto").addEventListener("click",e => {
  if(e.target.closest("button")) return;
  openLightbox(currentImage);
});
$("mainPhoto").addEventListener("keydown",e => {
  if(e.key === "Enter" || e.key === " "){
    e.preventDefault(); openLightbox(currentImage);
  }
});

/* ---------------- LIGHTBOX ---------------- */
function openLightbox(index=currentImage){
  if(!galleryImages.length) return;
  currentImage = index;
  updateLightbox();
  $("lightbox").classList.remove("hidden");
  $("lightbox").setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}
function closeLightbox(){
  $("lightbox").classList.add("hidden");
  $("lightbox").setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
}
function updateLightbox(){
  if(!galleryImages.length) return;
  $("lightboxImage").src = galleryImages[currentImage];
  $("lightboxCounter").textContent = `${currentImage + 1} / ${galleryImages.length}`;
}
$("lightboxClose").addEventListener("click",closeLightbox);
$("lightboxPrev").addEventListener("click",() => { nextGallery(-1); updateLightbox(); });
$("lightboxNext").addEventListener("click",() => { nextGallery(1); updateLightbox(); });
document.querySelector("[data-close-lightbox]").addEventListener("click",closeLightbox);

/* ---------------- CONFIGURATION / BHK ---------------- */
function renderConfigurations(p){
  const body = $("configurationBody");
  const rows = getBhkOptions(p);
  body.innerHTML = "";

  if(!rows.length){
    $("configurationSection").classList.add("hidden");
    return;
  }

  rows.forEach(item => {
    const bhk = getBhkLabel(item);
    const price = getBhkPrice(item);
    const area = getBhkArea(item);
    if(bhk === "—" && !price && !area) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(bhk)}</td>
      <td>${escapeHtml(formatPrice(price))}</td>
      <td>${escapeHtml(formatArea(area))}</td>
    `;
    body.appendChild(tr);
  });

  if(!body.children.length) $("configurationSection").classList.add("hidden");
  else $("configurationSection").classList.remove("hidden");
}

function populateEnquiry(p,bhkLabels,developer,name){
  $("enquiryDeveloper").value = developer === "—" ? "" : developer;
  const select = $("enquiryBhk");
  select.innerHTML = `<option value="">Select BHK</option>`;

  bhkLabels.forEach(label => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    select.appendChild(option);
  });

  if(bhkLabels.length === 1) select.value = bhkLabels[0];

  $("enquiryMessage").placeholder = `I'm interested in ${name}...`;
}

/* ---------------- AMENITIES ---------------- */
function renderAmenities(p){
  const container = $("amenities");
  const amenities = arrayValue(p.amenities);
  container.innerHTML = "";

  amenities.forEach(item => {
    const text = textFrom(item,"name","title","amenity","label");
    if(text === "—") return;
    const div = document.createElement("div");
    div.className = "amenity";
    div.textContent = text;
    container.appendChild(div);
  });

  $("amenitiesSection").classList.toggle("hidden",!container.children.length);
}

/* ---------------- LOCATION ADVANTAGES ---------------- */
function renderLocationAdvantages(p){
  const body = $("locationAdvantages");
  const rows = arrayValue(p.nearby_landmarks);
  body.innerHTML = "";

  rows.forEach(item => {
    const name = textFrom(item,"name","location","title","place");
    const distance = textFrom(item,"distance","distance_km","km");
    if(name === "—" && distance === "—") return;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(name)}</td><td>${escapeHtml(distance)}</td>`;
    body.appendChild(tr);
  });

  $("locationSection").classList.toggle("hidden",!body.children.length && !getLocation(p));
}

/* ---------------- MEDIA ---------------- */
function renderMedia(p){
  const section = $("mediaSection");
  const uploadedWrap = $("uploadedVideosWrap");
  const uploaded = $("uploadedVideos");
  const social = $("socialVideosWrap");

  uploaded.innerHTML = "";
  social.innerHTML = "";

  const directVideos = directVideoUrls(p.virtual_tour_video).filter(isDirectVideo);

  directVideos.forEach((url,index) => {
    const card = document.createElement("div");
    card.className = "video-card";
    card.innerHTML = `
      <video controls playsinline preload="metadata">
        <source src="${escapeAttr(url)}">
        Your browser does not support video playback.
      </video>
      <div class="media-caption">${directVideos.length > 1 ? `Property Video ${index + 1}` : "Property Video"}</div>
    `;
    uploaded.appendChild(card);
  });

  uploadedWrap.classList.toggle("hidden",!uploaded.children.length);

  addSocialPlayer(social,"YouTube",p.youtube_link,"youtube");
  addSocialPlayer(social,"Facebook",p.facebook_link,"facebook");
  addSocialPlayer(social,"Instagram",p.instagram_link,"instagram");

  const hasMedia = uploaded.children.length || social.children.length;
  section.classList.toggle("hidden",!hasMedia);
}

function addSocialPlayer(container,label,url,type){
  if(!url || typeof url !== "string" || !url.trim()) return;
  const clean = url.trim();
  const card = document.createElement("div");
  card.className = `social-card ${type}`;

  const head = document.createElement("div");
  head.className = "social-head";
  head.innerHTML = `<span>${type === "youtube" ? "▶" : type === "facebook" ? "f" : "◎"}</span>${escapeHtml(label)} Video`;
  card.appendChild(head);

  const embed = getSocialEmbed(clean,type);
  if(embed){
    const iframe = document.createElement("iframe");
    iframe.src = embed;
    iframe.title = `${label} property video`;
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    card.appendChild(iframe);
  }else{
    const fallback = document.createElement("div");
    fallback.className = "social-fallback";
    fallback.innerHTML = `${escapeHtml(label)} link is available.<br><a href="${escapeAttr(clean)}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(label)} →</a>`;
    card.appendChild(fallback);
  }

  const footer = document.createElement("div");
  footer.className = "social-footer";
  footer.innerHTML = `<a href="${escapeAttr(clean)}" target="_blank" rel="noopener noreferrer">Open on ${escapeHtml(label)} ↗</a>`;
  card.appendChild(footer);
  container.appendChild(card);
}

function getSocialEmbed(url,type){
  try{
    const u = new URL(url);

    if(type === "youtube"){
      let id = "";
      if(u.hostname.includes("youtu.be")) id = u.pathname.split("/").filter(Boolean)[0] || "";
      else if(u.searchParams.get("v")) id = u.searchParams.get("v");
      else {
        const parts = u.pathname.split("/").filter(Boolean);
        const index = parts.findIndex(x => ["shorts","embed","live"].includes(x));
        if(index >= 0) id = parts[index + 1] || "";
      }
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0` : null;
    }

    if(type === "facebook"){
      if(!/facebook\.com|fb\.watch/i.test(u.hostname)) return null;
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=500`;
    }

    if(type === "instagram"){
      if(!/instagram\.com/i.test(u.hostname)) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      const kindIndex = parts.findIndex(x => ["p","reel","reels","tv"].includes(x));
      if(kindIndex < 0 || !parts[kindIndex + 1]) return null;
      const kind = parts[kindIndex] === "reels" ? "reel" : parts[kindIndex];
      const code = parts[kindIndex + 1];
      return `https://www.instagram.com/${kind}/${encodeURIComponent(code)}/embed/`;
    }
  }catch(_){ }
  return null;
}

/* ---------------- FLOOR PLANS COMPATIBILITY ---------------- */
function renderFloorPlans(p){
  const plans = arrayValue(p.floor_plans ?? p.floor_plan ?? p.floorplan_images ?? p.floor_plan_images);
  const container = $("floorPlanGrid");
  container.innerHTML = "";
  if(!plans.length){ $("floorPlanSection").classList.add("hidden"); return; }

  plans.forEach(item => {
    const url = typeof item === "string" ? item : item?.url || item?.image_url || item?.src;
    if(!url) return;
    const label = typeof item === "string" ? "Floor Plan" : value(item.title,item.bhk,item.bhk_type,item.name,"Floor Plan");
    const card = document.createElement("div");
    card.className = "floor-plan-card";
    card.innerHTML = `<img src="${escapeAttr(url)}" alt="${escapeAttr(label)}"><div>${escapeHtml(label)}</div>`;
    container.appendChild(card);
  });
  $("floorPlanSection").classList.toggle("hidden",!container.children.length);
}

/* ---------------- MAP ---------------- */
function setupMap(p,location){
  const lat = p.latitude ?? p.lat;
  const lng = p.longitude ?? p.lng ?? p.lon;
  const mapUrl = p.map_url ?? p.google_maps_url;

  $("mapBtn").onclick = () => {
    if(mapUrl){ window.open(mapUrl,"_blank","noopener,noreferrer"); return; }
    if(lat !== undefined && lng !== undefined && lat !== null && lng !== null){
      window.open(`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`,"_blank","noopener,noreferrer");
      return;
    }
    if(location){
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`,"_blank","noopener,noreferrer");
    }
  };
}

/* ---------------- ENQUIRY ---------------- */
$("enquiryForm").addEventListener("submit",async event => {
  event.preventDefault();

  const button = $("sendBtn");
  const name = $("enquiryName").value.trim();
  const phone = $("enquiryPhone").value.trim();
  const email = $("enquiryEmail").value.trim();
  const developer = $("enquiryDeveloper").value.trim();
  const bhk = $("enquiryBhk").value.trim();
  const message = $("enquiryMessage").value.trim();

  if(!name || !phone){ showToast("Please enter your name and WhatsApp number."); return; }
  if(!bhk && $("enquiryBhk").options.length > 1){ showToast("Please select your preferred BHK."); return; }

  button.disabled = true;
  button.textContent = "Sending...";

  try{
    const projectName = getPropertyTitle(property);
    const payload = {
      name,
      mobile: phone,
      email: email || null,
      project_name: projectName,
      message: [
        message || `Interested in property ID ${propertyId}`,
        developer ? `Developer: ${developer}` : "",
        bhk ? `BHK: ${bhk}` : ""
      ].filter(Boolean).join("\n")
    };

    const {error} = await db.from("project_enquiries").insert(payload);
    if(error) throw error;

    showToast("Enquiry sent successfully.");
    $("enquiryMessage").value = "";
  }catch(error){
    console.error(error);
    showToast(error?.message || "Unable to submit enquiry.");
  }finally{
    button.disabled = false;
    button.textContent = "➤  Send Enquiry";
  }
});

/* ---------------- WHATSAPP ---------------- */
$("whatsappBtn").addEventListener("click",() => {
  const name = getPropertyTitle(property);
  const developer = property?.developer || "";
  const bhk = $("enquiryBhk").value || "";
  const message = [
    `Hi Keys99, I am interested in ${name}.`,
    developer ? `Developer: ${developer}` : "",
    bhk ? `Preferred BHK: ${bhk}` : "",
    `Property ID: ${propertyId}`
  ].filter(Boolean).join("\n");

  const rawNumber = property?.contact_number;
  const whatsappNumber = rawNumber ? String(rawNumber).replace(/\D/g,"") : "";
  if(!whatsappNumber){
    showToast("WhatsApp number is not available for this property.");
    return;
  }
  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer");
});

/* ---------------- SHARE / FAVORITE / BUTTONS ---------------- */
$("shareBtn").addEventListener("click",async() => {
  const title = getPropertyTitle(property);
  try{
    if(navigator.share){
      await navigator.share({title,text:`Check out ${title} on Keys99.com`,url:window.location.href});
    }else{
      await navigator.clipboard.writeText(window.location.href);
      showToast("Property link copied.");
    }
  }catch(_){ }
});

$("favoriteBtn").addEventListener("click",() => {
  $("favoriteBtn").classList.toggle("saved");
  const saved = $("favoriteBtn").classList.contains("saved");
  $("favoriteBtn").textContent = saved ? "♥" : "♡";
  showToast(saved ? "Added to favorites" : "Removed from favorites");
});

$("backBtn").addEventListener("click",() => {
  if(document.referrer) history.back();
  else window.location.href = "index.html#properties";
});

$("enquireTopBtn").addEventListener("click",() => {
  $("enquiryWrap").scrollIntoView({behavior:"smooth",block:"start"});
});

$("menuBtn").addEventListener("click",() => {
  $("mobileNav").classList.toggle("open");
  $("menuBtn").textContent = $("mobileNav").classList.contains("open") ? "×" : "☰";
});

/* ---------------- TOUCH SWIPE ---------------- */
let touchStartX = null;
document.addEventListener("touchstart", e => {
  if(e.touches.length === 1) touchStartX = e.touches[0].clientX;
}, {passive:true});
document.addEventListener("touchend", e => {
  if(touchStartX === null || !galleryImages.length) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  touchStartX = null;
  if(Math.abs(dx) < 45) return;
  if(!$('lightbox').classList.contains('hidden')) {
    nextGallery(dx < 0 ? 1 : -1);
    updateLightbox();
  } else if(e.target.closest('#mainPhoto')) {
    nextGallery(dx < 0 ? 1 : -1);
  }
}, {passive:true});

/* ---------------- KEYBOARD ---------------- */
document.addEventListener("keydown",e => {
  if($("lightbox").classList.contains("hidden")) return;
  if(e.key === "Escape") closeLightbox();
  if(e.key === "ArrowLeft"){ nextGallery(-1); updateLightbox(); }
  if(e.key === "ArrowRight"){ nextGallery(1); updateLightbox(); }
});

/* ---------------- ERROR / TOAST ---------------- */
function showError(message){
  $("loading").classList.add("hidden");
  $("propertyPage").classList.add("hidden");
  $("errorBox").classList.remove("hidden");
  const p = $("errorBox").querySelector("p");
  if(p && message) p.textContent = message;
}

let toastTimer;
function showToast(message){
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"),2600);
}

/* ---------------- START ---------------- */
loadProperty();
