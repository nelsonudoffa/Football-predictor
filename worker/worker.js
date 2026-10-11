/**
 * Football Predictor Cloudflare Worker.
 * Existing football-data.org proxy + server-side payment-request workflow.
 *
 * Required Worker bindings/secrets:
 *   D1 binding: DB
 *   Secret: FOOTBALL_DATA_API_KEY
 *   Secret: ADMIN_TOKEN (long random secret; never publish)
 *
 * Run schema.sql against the bound D1 database before enabling paid access.
 */
const ALLOWED_ORIGINS = new Set([
  "https://nelsonudoffa.github.io",
  "http://localhost:8788",
  "http://127.0.0.1:8787"
]);
const ADMIN_EMAIL = "neltech777@gmail.com";
const WHATSAPP_NUMBER = "2347066812516";
const PRICE_NAIRA = 2000;
const FREE_PREDICTIONS = 3;

function cors(request) {
  const origin = request.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://nelsonudoffa.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function json(request, data, status=200) {
  return new Response(JSON.stringify(data), {status, headers: {...cors(request), "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"}});
}
function clean(value, max=200) { return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0,max); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function id() { return crypto.randomUUID(); }
async function ensureDevice(request, env, body={}) {
  const deviceId = clean(body.deviceId, 80);
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(deviceId)) throw new Error("A valid device ID is required. Refresh the website and try again.");
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO fp_users (device_id, prediction_count, access_status, created_at, updated_at) VALUES (?, 0, 'free', ?, ?)").bind(deviceId, now, now).run();
  return deviceId;
}
async function requireAdmin(request, env) {
  const sent = request.headers.get("X-Admin-Token") || "";
  if (!env.ADMIN_TOKEN || sent.length < 24 || sent !== env.ADMIN_TOKEN) return false;
  return true;
}
async function handleAccess(request, env, url) {
  if (!env.DB) return json(request,{error:"Paid access database is not configured. Ask the site administrator to configure the D1 binding DB."},503);
  if (request.method === "GET" && url.pathname === "/access/status") {
    const deviceId = clean(url.searchParams.get("deviceId"),80);
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(deviceId)) return json(request,{error:"Valid deviceId required."},400);
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT OR IGNORE INTO fp_users (device_id, prediction_count, access_status, created_at, updated_at) VALUES (?, 0, 'free', ?, ?)").bind(deviceId,now,now).run();
    const row = await env.DB.prepare("SELECT device_id,prediction_count,access_status,approved_until FROM fp_users WHERE device_id=?").bind(deviceId).first();
    const paid = row.access_status === "approved" && (!row.approved_until || row.approved_until > now);
    return json(request,{ok:true,freeLimit:FREE_PREDICTIONS,predictionsUsed:row.prediction_count,paid,accessStatus:paid?"approved":row.access_status,priceNaira:PRICE_NAIRA});
  }
  if (request.method === "POST" && url.pathname === "/access/consume") {
    let body; try { body=await request.json(); } catch { return json(request,{error:"Invalid JSON."},400); }
    let deviceId; try { deviceId=await ensureDevice(request,env,body); } catch(e) { return json(request,{error:e.message},400); }
    const row = await env.DB.prepare("SELECT prediction_count,access_status,approved_until FROM fp_users WHERE device_id=?").bind(deviceId).first();
    const now = new Date().toISOString();
    const paid = row.access_status === "approved" && (!row.approved_until || row.approved_until > now);
    if (!paid && row.prediction_count >= FREE_PREDICTIONS) return json(request,{ok:false,locked:true,error:"Your 3 free predictions have been used. Submit your ₦2,000 payment for admin verification."},402);
    if (!paid) await env.DB.prepare("UPDATE fp_users SET prediction_count=prediction_count+1, updated_at=? WHERE device_id=?").bind(now,deviceId).run();
    const updated = await env.DB.prepare("SELECT prediction_count FROM fp_users WHERE device_id=?").bind(deviceId).first();
    return json(request,{ok:true,paid,predictionsUsed:updated.prediction_count,freeLimit:FREE_PREDICTIONS});
  }
  if (request.method === "POST" && url.pathname === "/access/request") {
    let body; try { body=await request.json(); } catch { return json(request,{error:"Invalid JSON."},400); }
    let deviceId; try { deviceId=await ensureDevice(request,env,body); } catch(e) { return json(request,{error:e.message},400); }
    const name=clean(body.name,100), email=clean(body.email,254).toLowerCase(), phone=clean(body.phone,30), method=clean(body.method,30), reference=clean(body.reference,120);
    if (!name || !validEmail(email) || !phone || !["OPay","Bank transfer"].includes(method) || reference.length < 3) return json(request,{error:"Enter your name, valid email, phone, payment method and payment reference."},400);
    const existing=await env.DB.prepare("SELECT request_id,status FROM fp_payment_requests WHERE device_id=? AND status='pending'").bind(deviceId).first();
    if (existing) return json(request,{ok:true,requestId:existing.request_id,status:"pending",message:"You already have a pending request. Contact the administrator if you need to correct its details."});
    const requestId=id(), now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO fp_payment_requests (request_id,device_id,student_name,email,phone,method,reference,amount_naira,status,created_at) VALUES (?,?,?,?,?,?,?,?,'pending',?)").bind(requestId,deviceId,name,email,phone,method,reference,PRICE_NAIRA,now).run();
    await env.DB.prepare("UPDATE fp_users SET contact_email=?, contact_name=?, updated_at=? WHERE device_id=?").bind(email,name,now,deviceId).run();
    const message = [
      "FOOTBALL PREDICTOR — PAYMENT APPROVAL REQUEST",
      "Request ID: "+requestId,
      "Student: "+name,
      "Email: "+email,
      "Phone: "+phone,
      "Amount: ₦"+PRICE_NAIRA.toLocaleString("en-NG"),
      "Method: "+method,
      "Payment reference: "+reference,
      "Status: PENDING — verify funds before approval.",
      "Admin page: https://nelsonudoffa.github.io/Football-predictor/#admin"
    ].join("\n");
    return json(request,{ok:true,requestId,status:"pending",whatsappUrl:"https://wa.me/"+WHATSAPP_NUMBER+"?text="+encodeURIComponent(message),message:"Request saved. Open WhatsApp to send the notification to the administrator."},201);
  }
  if (request.method === "GET" && url.pathname === "/admin/pending") {
    if (!await requireAdmin(request,env)) return json(request,{error:"Unauthorized admin token."},401);
    const rows=await env.DB.prepare("SELECT request_id,device_id,student_name,email,phone,method,reference,amount_naira,status,created_at FROM fp_payment_requests WHERE status='pending' ORDER BY created_at ASC LIMIT 100").all();
    return json(request,{ok:true,requests:rows.results||[]});
  }
  if (request.method === "POST" && url.pathname === "/admin/approve") {
    if (!await requireAdmin(request,env)) return json(request,{error:"Unauthorized admin token."},401);
    let body; try { body=await request.json(); } catch { return json(request,{error:"Invalid JSON."},400); }
    const requestId=clean(body.requestId,80);
    if (!requestId) return json(request,{error:"requestId is required."},400);
    const row=await env.DB.prepare("SELECT request_id,device_id,status FROM fp_payment_requests WHERE request_id=?").bind(requestId).first();
    if (!row) return json(request,{error:"Payment request not found."},404);
    if (row.status==="approved") return json(request,{ok:true,message:"Already approved."});
    if (row.status!=="pending") return json(request,{error:"This request is no longer pending."},409);
    const now=new Date().toISOString();
    // Manual approval is permanent until an admin sets an expiry in D1.
    await env.DB.batch([
      env.DB.prepare("UPDATE fp_payment_requests SET status='approved', reviewed_at=? WHERE request_id=?").bind(now,requestId),
      env.DB.prepare("UPDATE fp_users SET access_status='approved', approved_until=NULL, updated_at=? WHERE device_id=?").bind(now,row.device_id)
    ]);
    return json(request,{ok:true,message:"Payment request approved. Paid access is now enabled for this device."});
  }
  if (request.method === "POST" && url.pathname === "/admin/reject") {
    if (!await requireAdmin(request,env)) return json(request,{error:"Unauthorized admin token."},401);
    let body; try { body=await request.json(); } catch { return json(request,{error:"Invalid JSON."},400); }
    const requestId=clean(body.requestId,80);
    const result=await env.DB.prepare("UPDATE fp_payment_requests SET status='rejected', reviewed_at=? WHERE request_id=? AND status='pending'").bind(new Date().toISOString(),requestId).run();
    if (!result.meta?.changes) return json(request,{error:"Pending request not found."},404);
    return json(request,{ok:true,message:"Request rejected."});
  }
  return null;
}
export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if (request.method==="OPTIONS") return new Response(null,{status:204,headers:cors(request)});
    if (url.pathname==="/health") return json(request,{ok:true,service:"football-predictor-api"});
    try {
      if (url.pathname.startsWith("/access/") || url.pathname.startsWith("/admin/")) {
        const result=await handleAccess(request,env,url);
        if (result) return result;
      }
      // Existing football-data.org proxy.
      if (!/^\/v4\/(competitions|teams|matches)(\/|$)/.test(url.pathname)) return json(request,{error:"Not found"},404);
      if (!env.FOOTBALL_DATA_API_KEY) return json(request,{error:"Football data API key is not configured."},503);
      const target="https://api.football-data.org"+url.pathname+url.search;
      const upstream=await fetch(target,{headers:{"X-Auth-Token":env.FOOTBALL_DATA_API_KEY}});
      const headers=new Headers(upstream.headers);
      for (const [k,v] of Object.entries(cors(request))) headers.set(k,v);
      headers.set("Cache-Control","no-store");
      return new Response(upstream.body,{status:upstream.status,headers});
    } catch(e) {
      return json(request,{error:"Server error",detail:clean(e?.message||"Unknown error",300)},500);
    }
  }
};