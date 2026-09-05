let currentTheme="light";
const docs=[];
let chunks=[];
let idSeq=1;
let lastQuery="";
let embedder=null;
let embedMode="bm25";
const SAMPLE_NAME="client-side-privacy.txt";
const SAMPLE_TEXT=[
"On-device RAG is a retrieval tool that never uploads your documents. Everything runs in your browser:PDF text extraction,chunking,and ranking. Your files stay on this device.",
"This page indexes files locally with BM25,a classic keyword ranking function used in search engines. It always works,even offline after the page loads,and requires no model download. Queries return extractive snippets from your own text — there is no cloud LLM.",
"As a progressive enhancement,the tool can load a small MiniLM embedding model(all-MiniLM-L6-v2,about 23MB)via Transformers.js. The model is cached on this device. If download,CORS,or WASM fails,search continues with BM25 and says so.",
"Client-side privacy tools on this site process JSON,text,QR codes,and PDFs without a server. Nothing is sent to an API for analysis. That is the point:useful developer utilities that do not require trusting a backend with the contents of a file.",
"Chunking splits text into overlapping windows of about 2,000 characters(roughly 500 tokens)so a query can match a relevant passage rather than an entire book. Scores show how closely a chunk matches your question,with the source filename attached."
].join("\n\n");
function $(id){return document.getElementById(id);}
function toggleTheme(){
currentTheme=currentTheme==="light"?"dark":"light";
document.body.setAttribute("data-theme",currentTheme);
document.querySelector(".theme-toggle i").className=currentTheme==="light"?"fas fa-moon":"fas fa-sun";
localStorage.setItem("tools-theme",currentTheme);
localStorage.setItem("rag-theme",currentTheme);
}
function loadTheme(){
const saved=localStorage.getItem("tools-theme")||localStorage.getItem("rag-theme")||localStorage.getItem("jsonviz-theme")||"light";
currentTheme=saved;
document.body.setAttribute("data-theme",currentTheme);
document.querySelector(".theme-toggle i").className=currentTheme==="light"?"fas fa-moon":"fas fa-sun";
}
function escapeHtml(s){
return String(s).replace(/[&<>"']/g,function(c){
return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot","'":"&#39;"}[c];
});
}
function formatBytes(n){
if(!n||n<0)return "0 B";
const u=["B","KB","MB","GB"];
let i=0,v=n;
while(v>=1024&&i<u.length-1){v/=1024;i++;}
return(i===0?v:v.toFixed(v>=10?1:2))+" "+u[i];
}
function showBanner(type,html){
const el=$("banner");
el.className="banner show "+type;
el.innerHTML=html+'<button class="close-x" type="button" aria-label="Dismiss" onclick="hideBanner()"><i class="fas fa-times"></i></button>';
}
function hideBanner(){const el=$("banner");el.className="banner";el.innerHTML="";}
function setStatus(msg,cls){const el=$("statusText");el.textContent=msg;el.className=cls||"";}
function setRanker(mode,label){
embedMode=mode;
const pill=$("rankerPill");
pill.className="ranker-pill "+(mode==="embed"?"ready":mode==="down"?"down":mode==="fail"?"fail":"ready");
const icon=mode==="embed"?"fa-microchip":mode==="down"?"fa-download":mode==="fail"?"fa-bolt":"fa-bolt";
pill.innerHTML='<i class="fas '+icon+'"></i>'+escapeHtml(label);
$("embedNote").textContent=mode==="embed"?"Hybrid MiniLM+BM25":mode==="fail"?"Embeddings skipped":"";
}
function tokenize(text){
return(String(text).toLowerCase().match(/[a-z0-9]+/g)||[]).filter(function(t){return t.length>1;});
}
function chunkText(text,size,overlap){
size=size||2000;
overlap=overlap||300;
const clean=String(text).replace(/\r\n/g,"\n").replace(/[\t\u00a0]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
if(!clean)return[];
if(clean.length<=size)return[clean];
const out=[];
let start=0;
while(start<clean.length){
let end=Math.min(start+size,clean.length);
if(end<clean.length){
const slice=clean.slice(start,end);
const br=Math.max(slice.lastIndexOf(". "),slice.lastIndexOf("?"),slice.lastIndexOf("!"),slice.lastIndexOf("\n"));
if(br>size*0.45)end=start+br+1;
}
const piece=clean.slice(start,end).trim();
if(piece)out.push(piece);
if(end>=clean.length)break;
start=Math.max(end-overlap,start+1);
}
return out;
}
function bm25Rank(query,items){
const k1=1.5,b=0.75;
const qTokens=tokenize(query);
if(!qTokens.length||!items.length)return items.map(function(it){return{item:it,bm25:0};});
const N=items.length;
const df={};
const docs=items.map(function(it){
const tokens=tokenize(it.text);
const tf={};
tokens.forEach(function(t){tf[t]=(tf[t]||0)+1;});
Object.keys(tf).forEach(function(t){df[t]=(df[t]||0)+1;});
return{item:it,tf:tf,len:Math.max(tokens.length,1)};
});
const avgdl=docs.reduce(function(s,d){return s+d.len;},0)/docs.length;
return docs.map(function(d){
let score=0;
const seen={};
qTokens.forEach(function(qt){
if(seen[qt])return;
seen[qt]=1;
const nq=df[qt]||0;
const idf=Math.log((N-nq+0.5)/(nq+0.5)+1);
const f=d.tf[qt]||0;
const denom=f+k1*(1-b+b*(d.len/avgdl));
score+=idf*(f*(k1+1))/(denom||1);
});
return{item:d.item,bm25:score};
}).sort(function(a,b){return b.bm25-a.bm25;});
}
function cosine(a,b){
if(!a||!b||a.length!==b.length)return 0;
let s=0;
for(let i=0;i<a.length;i++)s+=a[i]*b[i];
return s;
}
async function extractPdf(bytes){
if(typeof pdfjsLib==="undefined")throw new Error("pdf.js failed to load from the CDN.");
const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
const parts=[];
for(let i=1;i<=pdf.numPages;i++){
const page=await pdf.getPage(i);
const content=await page.getTextContent();
const text=content.items.map(function(it){return it.str;}).join(" ");
parts.push(text);
}
return parts.join("\n");
}
async function addFiles(fileList){
const files=Array.from(fileList||[]).filter(Boolean);
if(!files.length)return;
hideBanner();
const errors=[];
let added=0;
for(const file of files){
try{
const name=file.name||"untitled";
const lower=name.toLowerCase();
let text="";
if(lower.endsWith(".pdf")||file.type==="application/pdf"){
const bytes=new Uint8Array(await file.arrayBuffer());
text=await extractPdf(bytes);
}else if(lower.endsWith(".txt")||lower.endsWith(".md")||(file.type||"").indexOf("text")===0){
text=await file.text();
}else{
errors.push(name+" is not a PDF,TXT,or Markdown file.");
continue;
}
text=(text||"").trim();
if(!text){errors.push(name+" had no extractable text.");continue;}
ingestDoc(name,text,file.size||text.length);
added++;
}catch(err){
const msg=(err&&err.message)?err.message:String(err);
if(/password|encrypt/i.test(msg))errors.push(file.name+" is encrypted and cannot be read.");
else errors.push(file.name+":"+msg);
}
}
renderDocs();
if(errors.length){
showBanner("error",'<i class="fas fa-exclamation-triangle"></i><div><strong>Some files were skipped</strong><br>'+
errors.map(escapeHtml).join("<br>")+"</div>");
}
if(added){
setStatus("Indexed "+added+" file"+(added===1?"":"s")+" · "+chunks.length+" chunks","ok");
await embedPending();
}
}
function ingestDoc(name,text,size){
const docId="d"+(idSeq++);
const parts=chunkText(text,2000,300);
docs.push({id:docId,name:name,text:text,size:size||text.length,nChunks:parts.length});
parts.forEach(function(piece,i){
chunks.push({
id:"c"+(idSeq++),
docId:docId,
source:name,
index:i,
text:piece,
embedding:null
});
});
}
function renderDocs(){
const list=$("docList");
$("pillDocs").textContent=docs.length+" file"+(docs.length===1?"":"s");
$("pillChunks").textContent=chunks.length+" chunk"+(chunks.length===1?"":"s");
const chars=docs.reduce(function(s,d){return s+d.text.length;},0);
$("pillChars").textContent=chars.toLocaleString()+" chars";
$("btnClear").disabled=docs.length===0;
if(!docs.length){
list.innerHTML='<li class="empty-state" style="padding:1.2rem 0;"><i class="fas fa-folder-open"></i>No documents yet.</li>';
return;
}
list.innerHTML=docs.map(function(d){
return '<li class="doc-item"><div><div class="name">'+escapeHtml(d.name)+"</div>"+
'<div class="meta">'+d.nChunks+" chunks · "+d.text.length.toLocaleString()+" chars · "+formatBytes(d.size)+"</div></div></li>";
}).join("");
}
function snippetAround(text,query,win){
win=win||320;
const lower=text.toLowerCase();
let idx=0;
const toks=tokenize(query);
for(let i=0;i<toks.length;i++){
const pos=lower.indexOf(toks[i]);
if(pos>=0){idx=pos;break;}
}
const start=Math.max(0,idx-Math.floor(win/4));
const end=Math.min(text.length,start+win);
let s=text.slice(start,end).trim();
if(start>0)s="…"+s;
if(end<text.length)s+="…";
return s;
}
function highlight(text,query){
const toks=[];
const seen={};
tokenize(query).forEach(function(t){
if(t.length<2||seen[t])return;
seen[t]=1;
toks.push(t);
});
toks.sort(function(a,b){return b.length-a.length;});
let html=escapeHtml(text);
toks.forEach(function(t){
const re=new RegExp("("+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi");
html=html.replace(re,"<mark>$1</mark>");
});
return html;
}
function onSearch(e){
if(e)e.preventDefault();
const q=$("queryInput").value.trim();
lastQuery=q;
runQuery(q);
}
function runQuery(q){
const box=$("results");
if(!q){
box.innerHTML='<div class="empty-state"><i class="fas fa-comments"></i>Type a query to retrieve snippets.</div>';
$("resultMode").textContent="";
return;
}
if(!chunks.length){
box.innerHTML='<div class="empty-state"><i class="fas fa-folder-open"></i>Load a document or the sample first.</div>';
return;
}
const bm=bm25Rank(q,chunks);
const maxB=Math.max.apply(null,bm.map(function(r){return r.bm25;}).concat([1e-9]));
const useEmbed=embedMode==="embed"&&chunks.every(function(c){return c.embedding;})&&window.__embedQuery;
let ranked;
if(useEmbed){
const qv=window.__lastQueryVec;
ranked=bm.map(function(r){
const cos=cosine(qv,r.item.embedding);
const bnorm=r.bm25/maxB;
return{item:r.item,score:0.7*cos+0.3*bnorm,cos:cos,bm25:r.bm25};
}).sort(function(a,b){return b.score-a.score;});
$("resultMode").textContent="hybrid MiniLM+BM25";
}else{
ranked=bm.map(function(r){return{item:r.item,score:r.bm25,bm25:r.bm25};});
$("resultMode").textContent="BM25";
}
const top=ranked.filter(function(r){return r.score>0.02||(r.bm25&&r.bm25>0);}).slice(0,8);
if(!top.length){
box.innerHTML='<div class="empty-state"><i class="fas fa-ghost"></i>No matching chunks. Try different keywords.</div>';
setStatus("No matches for “"+q+"”");
return;
}
box.innerHTML=top.map(function(r,i){
const snip=snippetAround(r.item.text,q);
const scoreStr=useEmbed?(r.cos*100).toFixed(1)+"% cos · BM25 "+r.bm25.toFixed(2):r.score.toFixed(3);
return '<article class="result"><div class="result-top"><strong>'+escapeHtml(r.item.source)+
"</strong>chunk "+(r.item.index+1)+'<span class="score">#'+(i+1)+" · "+scoreStr+"</span></div>"+
'<div class="snippet">'+highlight(snip,q)+"</div></article>";
}).join("");
setStatus(top.length+" snippet"+(top.length===1?"":"s")+" · "+(useEmbed?"hybrid ranking":"BM25"),"ok");
}
async function searchWithEmbed(q){
if(embedMode==="embed"&&window.__embedQuery){
try{window.__lastQueryVec=await window.__embedQuery(q);}catch(e){window.__lastQueryVec=null;}
}
runQuery(q);
}
function loadSample(){
hideBanner();
if(docs.some(function(d){return d.name===SAMPLE_NAME;})){
setStatus("Sample already loaded");
return;
}
ingestDoc(SAMPLE_NAME,SAMPLE_TEXT,SAMPLE_TEXT.length);
renderDocs();
setStatus("Sample document indexed · "+chunks.length+" chunks","ok");
$("queryInput").value="What stays on this device?";
lastQuery=$("queryInput").value;
runQuery(lastQuery);
embedPending();
}
function clearDocs(){
docs.length=0;
chunks=[];
hideBanner();
renderDocs();
$("results").innerHTML='<div class="empty-state"><i class="fas fa-comments"></i>Load a document and run a query to see extractive snippets.</div>';
$("resultMode").textContent="";
setStatus("Cleared · BM25 index empty");
}
async function embedPending(){
if(!window.__embedText||embedMode!=="embed")return;
const pending=chunks.filter(function(c){return!c.embedding;});
if(!pending.length)return;
setStatus("Embedding "+pending.length+" chunk"+(pending.length===1?"":"s")+" on device…");
for(let i=0;i<pending.length;i++){
try{
pending[i].embedding=await window.__embedText(pending[i].text);
}catch(e){
setRanker("fail","BM25 ready — embedding failed. Keyword search still works.");
return;
}
if((i+1)% 4===0)setStatus("Embedding "+(i+1)+"/"+pending.length+" chunks…");
}
setStatus("Embedded "+chunks.length+" chunks · hybrid ranking on","ok");
if(lastQuery)searchWithEmbed(lastQuery);
}
function initDrop(){
const zone=$("dropzone");
const input=$("fileInput");
zone.addEventListener("click",function(){input.click();});
zone.addEventListener("keydown",function(e){
if(e.key==="Enter"||e.key===" "){e.preventDefault();input.click();}
});
input.addEventListener("change",function(e){
addFiles(e.target.files);
input.value="";
});
["dragenter","dragover"].forEach(function(ev){
zone.addEventListener(ev,function(e){e.preventDefault();zone.classList.add("dragover");});
});
["dragleave","drop"].forEach(function(ev){
zone.addEventListener(ev,function(e){e.preventDefault();zone.classList.remove("dragover");});
});
zone.addEventListener("drop",function(e){addFiles(e.dataTransfer.files);});
window.addEventListener("dragover",function(e){e.preventDefault();});
window.addEventListener("drop",function(e){
e.preventDefault();
if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length)addFiles(e.dataTransfer.files);
});
}
function onSearch(e){
if(e)e.preventDefault();
const q=$("queryInput").value.trim();
lastQuery=q;
if(embedMode==="embed"&&window.__embedQuery)searchWithEmbed(q);
else runQuery(q);
}
function initPdfJs(){
if(typeof pdfjsLib==="undefined"){
showBanner("error",'<i class="fas fa-exclamation-triangle"></i><div>pdf.js did not load. PDF drop will fail;TXT and Markdown still work.</div>');
return;
}
pdfjsLib.GlobalWorkerOptions.workerSrc=window.__PDFJS_WORKER||"";
}
window.__onEmbedReady=async function(){
setRanker("embed","Embeddings ready(MiniLM)");
await embedPending();
};
window.__onEmbedProgress=function(label){
setRanker("down",label);
};
window.__onEmbedFail=function(reason){
setRanker("fail","BM25 ready — embedding model unavailable("+reason+"). Keyword search still works.");
};
loadTheme();
initPdfJs();
initDrop();
renderDocs();
setRanker("bm25","BM25 ready");
