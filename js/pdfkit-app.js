let currentTheme="light";
const sources=new Map();
let pages=[];
let dragId=null;
let idSeq=1;
function $(id){return document.getElementById(id);}
function toggleTheme(){
currentTheme=currentTheme==="light"?"dark":"light";
document.body.setAttribute("data-theme",currentTheme);
document.querySelector(".theme-toggle i").className=currentTheme==="light"?"fas fa-moon":"fas fa-sun";
localStorage.setItem("tools-theme",currentTheme);
localStorage.setItem("pdfkit-theme",currentTheme);
}
function loadTheme(){
const saved=localStorage.getItem("tools-theme")||localStorage.getItem("pdfkit-theme")||localStorage.getItem("jsonviz-theme")||"light";
currentTheme=saved;
document.body.setAttribute("data-theme",currentTheme);
document.querySelector(".theme-toggle i").className=currentTheme==="light"?"fas fa-moon":"fas fa-sun";
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
function uniqueFileId(name){return name+"::"+Date.now()+"::"+(idSeq++);}
function isEncryptedError(err){
const m=(err&&err.message)?err.message:String(err||"");
return/encrypt/i.test(m)||/password/i.test(m);
}
function escapeHtml(s){
return String(s).replace(/[&<>"']/g,function(c){
return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
});
}
async function addFiles(fileList){
const files=Array.from(fileList||[]).filter(Boolean);
if(!files.length)return;
hideBanner();
let added=0;
const errors=[];
for(const file of files){
const isPdf=file.type==="application/pdf"||/\.pdf$/i.test(file.name);
if(!isPdf){errors.push(file.name+" is not a PDF.");continue;}
try{
const bytes=new Uint8Array(await file.arrayBuffer());
let pdfDoc;
try{
pdfDoc=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false});
}catch(err){
if(isEncryptedError(err)){
errors.push(file.name+" is encrypted or password-protected and cannot be opened in the browser.");
}else{
errors.push(file.name+" could not be read. It may be damaged or not a valid PDF.");
}
continue;
}
const count=pdfDoc.getPageCount();
if(!count){errors.push(file.name+" has no pages.");continue;}
const fileId=uniqueFileId(file.name);
sources.set(fileId,{name:file.name,pdfDoc:pdfDoc,pageCount:count,size:file.size});
for(let i=0;i<count;i++){
pages.push({id:"p"+(idSeq++),fileId:fileId,filename:file.name,pageIndex:i,rotation:0});
}
added++;
}catch(err){
errors.push(file.name+":"+(err.message||"failed to load"));
}
}
render();
if(errors.length){
showBanner("error",'<i class="fas fa-exclamation-triangle"></i><div><strong>Some files were skipped</strong><br>'+
errors.map(escapeHtml).join("<br>")+"</div>");
}
if(added)setStatus("Loaded "+added+" file"+(added===1?"":"s")+" · "+pages.length+" pages in working set","ok");
}
function selectedPages(){
return pages.filter(function(p){
const cb=document.querySelector('input[data-page="'+p.id+'"]');
return cb&&cb.checked;
});
}
function selectedIds(){
return new Set(selectedPages().map(function(p){return p.id;}));
}
function render(){
const list=$("pageList");
const fileIds=[];
pages.forEach(function(p){if(fileIds.indexOf(p.fileId)=== -1)fileIds.push(p.fileId);});
const totalBytes=fileIds.reduce(function(sum,id){
const s=sources.get(id);
return sum+(s?s.size:0);
},0);
$("pillFiles").textContent=fileIds.length+" file"+(fileIds.length===1?"":"s");
$("pillPages").textContent=pages.length+" page"+(pages.length===1?"":"s");
$("pillSize").textContent=formatBytes(totalBytes);
const has=pages.length>0;
$("btnMerge").disabled=!has;
$("btnClear").disabled=!has;
if(!pages.length){
list.innerHTML='<li class="empty-state"><i class="fas fa-layer-group"></i>No pages yet. Drop one or more PDFs to build a working set.</li>';
$("selectAll").checked=false;
$("pillSelected").textContent="0 selected";
["btnSplit","btnRot90","btnRot180","btnRot270","btnRemove"].forEach(function(id){$(id).disabled=true;});
return;
}
list.innerHTML=pages.map(function(p){
const src=sources.get(p.fileId);
const rot=p.rotation % 360;
return '<li class="page-row" draggable="true" data-id="'+p.id+'">'+'<span class="grip" title="Drag to reorder" aria-hidden="true"><i class="fas fa-grip-vertical"></i></span>'+'<input type="checkbox" data-page="'+p.id+'" aria-label="Select page">'+'<div class="page-info"><div class="page-name">'+escapeHtml(p.filename)+"</div>"+'<div class="page-sub">page '+(p.pageIndex+1)+" of "+(src?src.pageCount:"?")+(src?" · source "+formatBytes(src.size):"")+"</div></div>"+(rot?'<span class="rot-badge">'+rot+"°</span>":"<span></span>")+"<div class=\"row-actions\">"+'<button class="icon-btn" type="button" title="Move up" data-move="'+p.id+'" data-dir="-1"><i class="fas fa-chevron-up"></i></button>'+'<button class="icon-btn" type="button" title="Move down" data-move="'+p.id+'" data-dir="1"><i class="fas fa-chevron-down"></i></button>'+"</div></li>";
}).join("");
list.querySelectorAll(".page-row").forEach(bindDrag);
list.querySelectorAll("input[data-page]").forEach(function(cb){cb.addEventListener("change",updateSelectionUi);});
list.querySelectorAll("button[data-move]").forEach(function(btn){
btn.addEventListener("click",function(){
movePage(btn.getAttribute("data-move"),parseInt(btn.getAttribute("data-dir"),10));
});
});
updateSelectionUi();
}
function bindDrag(row){
row.addEventListener("dragstart",function(e){
dragId=row.getAttribute("data-id");
row.classList.add("dragging");
e.dataTransfer.effectAllowed="move";
try{e.dataTransfer.setData("text/plain",dragId);}catch(err){}
});
row.addEventListener("dragend",function(){
row.classList.remove("dragging");
document.querySelectorAll(".page-row.drag-over").forEach(function(el){el.classList.remove("drag-over");});
});
row.addEventListener("dragover",function(e){e.preventDefault();row.classList.add("drag-over");});
row.addEventListener("dragleave",function(){row.classList.remove("drag-over");});
row.addEventListener("drop",function(e){
e.preventDefault();
row.classList.remove("drag-over");
const targetId=row.getAttribute("data-id");
if(!dragId||dragId===targetId)return;
const from=pages.findIndex(function(p){return p.id===dragId;});
const to=pages.findIndex(function(p){return p.id===targetId;});
if(from<0||to<0)return;
const item=pages.splice(from,1)[0];
pages.splice(to,0,item);
render();
});
}
function movePage(id,dir){
const i=pages.findIndex(function(p){return p.id===id;});
const j=i+dir;
if(i<0||j<0||j>=pages.length)return;
const sel=selectedIds();
const item=pages.splice(i,1)[0];
pages.splice(j,0,item);
render();
restoreSelection(sel);
}
function restoreSelection(idSet){
document.querySelectorAll("input[data-page]").forEach(function(cb){
if(idSet.has(cb.getAttribute("data-page")))cb.checked=true;
});
updateSelectionUi();
}
function updateSelectionUi(){
const n=selectedPages().length;
$("pillSelected").textContent=n+" selected";
const disableSel=n===0;
["btnSplit","btnRot90","btnRot180","btnRot270","btnRemove"].forEach(function(id){$(id).disabled=disableSel;});
const boxes=Array.prototype.slice.call(document.querySelectorAll("input[data-page]"));
$("selectAll").checked=boxes.length>0&&boxes.every(function(b){return b.checked;});
document.querySelectorAll(".page-row").forEach(function(row){
const cb=row.querySelector("input[data-page]");
row.classList.toggle("selected",!!(cb&&cb.checked));
});
}
function toggleSelectAll(on){
document.querySelectorAll("input[data-page]").forEach(function(cb){cb.checked=on;});
updateSelectionUi();
}
function rotateSelected(deg){
const ids=selectedIds();
pages.forEach(function(p){if(ids.has(p.id))p.rotation=(p.rotation+deg)% 360;});
render();
restoreSelection(ids);
setStatus("Rotated "+ids.size+" page"+(ids.size===1?"":"s")+" by "+deg+"°(applied on download)");
}
function removeSelected(){
const ids=selectedIds();
pages=pages.filter(function(p){return!ids.has(p.id);});
pruneSources();
render();
setStatus("Removed "+ids.size+" page"+(ids.size===1?"":"s")+" from the working set");
}
function pruneSources(){
const used=new Set(pages.map(function(p){return p.fileId;}));
Array.from(sources.keys()).forEach(function(id){if(!used.has(id))sources.delete(id);});
}
function clearAll(){
pages=[];
sources.clear();
hideBanner();
$("exportSize").textContent="";
render();
setStatus("Cleared · drop PDFs to begin");
}
function stripMetadata(pdfDoc){
try{pdfDoc.setTitle("");}catch(e){}
try{pdfDoc.setAuthor("");}catch(e){}
try{pdfDoc.setSubject("");}catch(e){}
try{pdfDoc.setKeywords([]);}catch(e){}
try{pdfDoc.setProducer("");}catch(e){}
try{pdfDoc.setCreator("");}catch(e){}
try{pdfDoc.setCreationDate(new Date(0));}catch(e){}
try{pdfDoc.setModificationDate(new Date(0));}catch(e){}
try{
const info=pdfDoc.getInfoDict&&pdfDoc.getInfoDict();
if(info&&PDFLib.PDFName){
["Title","Author","Subject","Keywords","Producer","Creator","CreationDate","ModDate","Trapped"].forEach(function(k){
try{info.delete(PDFLib.PDFName.of(k));}catch(e){}
});
}
}catch(e){}
try{
const catalog=pdfDoc.catalog;
if(catalog&&catalog.has&&catalog.has(PDFLib.PDFName.of("Metadata"))){
catalog.delete(PDFLib.PDFName.of("Metadata"));
}
}catch(e){}
}
async function exportPages(selectedOnly){
const items=selectedOnly?selectedPages():pages.slice();
if(!items.length){
showBanner("error",'<i class="fas fa-info-circle"></i><div>Select at least one page to keep.</div>');
return;
}
setStatus("Building PDF…");
try{
const out=await PDFLib.PDFDocument.create();
for(const item of items){
const src=sources.get(item.fileId);
if(!src)throw new Error("Missing source for "+item.filename);
const copiedPair=await out.copyPages(src.pdfDoc,[item.pageIndex]);
const copied=copiedPair[0];
const extra=(item.rotation||0)% 360;
if(extra){
let current=0;
try{current=copied.getRotation().angle||0;}catch(e){current=0;}
copied.setRotation(PDFLib.degrees((current+extra)% 360));
}
out.addPage(copied);
}
if($("stripMeta").checked)stripMetadata(out);
const bytes=await out.save();
const name=selectedOnly?"pocketknife-selected.pdf":"pocketknife-merged.pdf";
downloadPdf(bytes,name);
$("exportSize").textContent="Last download "+formatBytes(bytes.byteLength)+" · "+items.length+" pages";
setStatus("Downloaded "+name+"("+formatBytes(bytes.byteLength)+")","ok");
showBanner("ok",'<i class="fas fa-check-circle"></i><div>Saved<strong>'+escapeHtml(name)+"</strong>— "+items.length+" page"+(items.length===1?"":"s")+","+formatBytes(bytes.byteLength)+($("stripMeta").checked?". Metadata stripped.":".")+"</div>");
}catch(err){
const msg=isEncryptedError(err)?"A source PDF is encrypted and cannot be written.":(err.message||"Failed to build PDF");
showBanner("error",'<i class="fas fa-exclamation-triangle"></i><div>'+escapeHtml(msg)+"</div>");
setStatus(msg,"err");
}
}
function downloadPdf(bytes,filename){
const blob=new Blob([bytes],{type:"application/pdf"});
const url=URL.createObjectURL(blob);
const a=document.createElement("a");
a.href=url;
a.download=filename;
document.body.appendChild(a);
a.click();
a.remove();
setTimeout(function(){URL.revokeObjectURL(url);},1500);
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
document.addEventListener("DOMContentLoaded",function(){
loadTheme();
initDrop();
render();
});
