let currentTheme='light';
let mode='redact';
let lastFindings=[];
let lastPlain='';
let scanTimer=null;
const TYPE_META={
pem:{label:'PEM Key',tag:'PEM_KEY',chip:'#9c27b0'},
jwt:{label:'JWT',tag:'JWT',chip:'#9c27b0'},
aws_key:{label:'AWS Key',tag:'AWS_KEY',chip:'#9c27b0'},
github_pat:{label:'GitHub PAT',tag:'GITHUB_PAT',chip:'#9c27b0'},
slack_token:{label:'Slack Token',tag:'SLACK_TOKEN',chip:'#9c27b0'},
bearer:{label:'Bearer Token',tag:'BEARER_TOKEN',chip:'#9c27b0'},
email:{label:'Email',tag:'EMAIL',chip:'#dc3545'},
ssn:{label:'SSN',tag:'SSN',chip:'#dc3545'},
credit_card:{label:'Credit Card',tag:'CREDIT_CARD',chip:'#e67700'},
ipv6:{label:'IPv6',tag:'IPV6',chip:'#007bff'},
ipv4:{label:'IPv4',tag:'IPV4',chip:'#007bff'},
phone:{label:'Phone',tag:'PHONE',chip:'#dc3545'},
secret:{label:'Possible secret',tag:'SECRET',chip:'#9c27b0'}
};
function toggleTheme(){
currentTheme=currentTheme==='light'?'dark':'light';
document.body.setAttribute('data-theme',currentTheme);
const icon=document.querySelector('.theme-toggle i');
icon.className=currentTheme==='light'?'fas fa-moon':'fas fa-sun';
localStorage.setItem('pii-theme',currentTheme);
localStorage.setItem('tools-theme',currentTheme);
}
function loadTheme(){
const saved=localStorage.getItem('tools-theme')||localStorage.getItem('pii-theme')||localStorage.getItem('jsonviz-theme')||'light';
currentTheme=saved;
document.body.setAttribute('data-theme',currentTheme);
const icon=document.querySelector('.theme-toggle i');
icon.className=currentTheme==='light'?'fas fa-moon':'fas fa-sun';
}
function toast(msg,kind){
const el=document.getElementById('toast');
el.className='toast show'+(kind==='error'?' error':'');
el.innerHTML='<i class="fas '+(kind==='error'?'fa-exclamation-circle':'fa-check')+'"></i>'+escapeHtml(msg);
clearTimeout(toast._t);
toast._t=setTimeout(()=>el.classList.remove('show'),2200);
}
function escapeHtml(text){
return String(text)
.replace(/&/g,'&amp;')
.replace(/</g,'&lt;')
.replace(/>/g,'&gt;')
.replace(/"/g,'&quot;');
}
function luhnOk(num){
const d=num.replace(/\D/g,'');
if(d.length<13||d.length>19)return false;
if(/^(\d)\1+$/.test(d))return false;
let sum=0,alt=false;
for(let i=d.length-1;i>=0;i--){
let n=d.charCodeAt(i)-48;
if(alt){n*=2;if(n>9)n-=9;}
sum+=n;
alt=!alt;
}
return sum % 10===0;
}
function ssnPlausible(raw){
const d=raw.replace(/\D/g,'');
if(d.length!==9)return false;
const area=d.slice(0,3),group=d.slice(3,5),serial=d.slice(5);
if(area==='000'||area==='666'||area[0]==='9')return false;
if(group==='00'||serial==='0000')return false;
if(/^(\d)\1{8}$/.test(d))return false;
return true;
}
function entropyOk(s){
if(s.length<20)return false;
const uniq=new Set(s).size;
if(uniq<8)return false;
let classes=0;
if(/[a-z]/.test(s))classes++;
if(/[A-Z]/.test(s))classes++;
if(/\d/.test(s))classes++;
if(/[^A-Za-z0-9]/.test(s))classes++;
if(classes<2&&!/^[A-Fa-f0-9]{32,}$/.test(s))return false;
if(/^(https?:|www\.)/i.test(s))return false;
if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))return false;
return true;
}
function overlaps(occupied,start,end){
for(let i=0;i<occupied.length;i++){
const s=occupied[i][0],e=occupied[i][1];
if(start<e&&end>s)return true;
}
return false;
}
function isValidIPv6(ip){
if(/:::/.test(ip)||!ip.includes(':')||/[^0-9a-fA-F:]/.test(ip))return false;
const compressed=ip.includes('::');
const sides=ip.split('::');
if(sides.length>2)return false;
const split=s=>s===''?[]:s.split(':');
const g=compressed?split(sides[0]).concat(split(sides[1]||'')):ip.split(':');
if(!g.length||g.some(x=>x===''||!/^[0-9a-fA-F]{1,4}$/.test(x)))return false;
return compressed?g.length<=7:g.length===8;
}
function detectPII(text){
const occupied=[];
const findings=[];
function take(start,end,type){
if(start<0||end<=start||end>text.length)return;
if(overlaps(occupied,start,end))return;
occupied.push([start,end]);
findings.push({start,end,type,value:text.slice(start,end)});
}
function scan(re,type,pred){
re.lastIndex=0;
let m;
while((m=re.exec(text))){
if(!m[0].length){re.lastIndex++;continue;}
let start=m.index;
let end=m.index+m[0].length;
if(pred){
const extra=pred(m);
if(extra===false)continue;
if(extra&&typeof extra==='object'){
if(Number.isFinite(extra.start))start=extra.start;
if(Number.isFinite(extra.end))end=extra.end;
}
}
take(start,end,type);
}
}
scan(/-----BEGIN(?:[A-Z]+)?PRIVATE KEY-----[\s\S]*?-----END(?:[A-Z]+)?PRIVATE KEY-----/g,'pem');
scan(/-----BEGIN(?:[A-Z]+)?PRIVATE KEY-----/g,'pem');
scan(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,'jwt');
scan(/\bAKIA[0-9A-Z]{16}\b/g,'aws_key');
scan(/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,'github_pat');
scan(/\bghp_[A-Za-z0-9]{36}\b/g,'github_pat');
scan(/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,'slack_token');
scan(/\bBearer\s+[A-Za-z0-9._\-+/=]{8,}/gi,'bearer');
scan(/\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi,'email');
scan(/\b(?!000|666|9\d{2})\d{3}[\-]\d{2}[\-]\d{4}\b/g,'ssn',m=>ssnPlausible(m[0]));
scan(/(?<![\d])(?:\d[\-]?){13,19}(?![\d])/g,'credit_card',m=>{
let raw=m[0];
while(/[\-]$/.test(raw))raw=raw.slice(0,-1);
const digits=raw.replace(/\D/g,'');
if(digits.length<13||digits.length>19)return false;
if(!/^[3-6]/.test(digits))return false;
if(!luhnOk(digits))return false;
return{end:m.index+raw.length};
});
scan(/(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}/g,'ipv6',m=>{
const v=m[0];
if((v.match(/:/g)||[]).length<2)return false;
return isValidIPv6(v);
});
scan(/\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,'ipv4');
scan(/(?<![\w])(?:\+?1[-.\s]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[-.\s]?\d{3}[-.\s]?\d{4}\b/g,'phone',m=>{
const d=m[0].replace(/\D/g,'');
return d.length===10||(d.length===11&&d[0]==='1');
});
scan(/\+[1-9]\d{0,3}(?:[.\-()]*\d){6,13}/g,'phone',m=>{
const d=m[0].replace(/\D/g,'');
return d.length>=8&&d.length<=15;
});
scan(/\b[A-Za-z0-9+/]{24,}={0,2}\b/g,'secret',m=>{
if(/^[A-Za-z]+$/.test(m[0]))return false;
return entropyOk(m[0]);
});
scan(/\b[A-Fa-f0-9]{32,}\b/g,'secret',m=>entropyOk(m[0]));
findings.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start));
return findings;
}
function maskValue(value,type){
if(type==='pem')return '[PEM_KEY]';
if(type==='email'){
const at=value.lastIndexOf('@');
if(at<0)return maskLast4(value);
const local=value.slice(0,at);
const domain=value.slice(at);
if(local.length<=4)return '*'.repeat(local.length)+domain;
return '*'.repeat(local.length-4)+local.slice(-4)+domain;
}
if(type==='phone'||type==='ssn'||type==='credit_card'){
const total=(value.match(/\d/g)||[]).length;
const keep=Math.min(4,total);
let seen=0;
return value.replace(/\d/g,d=>{
seen++;
return(total-seen)<keep?d:'*';
});
}
if(type==='ipv4'){
const p=value.split('.');
return p.map((part,i)=>i===p.length-1?part:'*'.repeat(part.length)).join('.');
}
if(type==='ipv6'){
const p=value.split(':');
return p.map((g,i)=>(i===p.length-1&&g)?g:(g?'*'.repeat(Math.min(4,g.length)):g)).join(':');
}
return maskLast4(value);
}
function maskLast4(value){
if(value.length<=4)return '*'.repeat(value.length);
return '*'.repeat(value.length-4)+value.slice(-4);
}
function transform(value,type){
if(mode==='mask')return maskValue(value,type);
return '['+TYPE_META[type].tag+']';
}
function setMode(next){
mode=next;
document.querySelectorAll('.seg-btn').forEach(btn=>{
const on=btn.getAttribute('data-mode')===next;
btn.classList.toggle('active',on);
btn.setAttribute('aria-selected',on?'true':'false');
});
render();
}
function scheduleScan(){
const input=document.getElementById('sourceInput').value;
document.getElementById('charCount').textContent=input.length.toLocaleString()+' characters';
if(scanTimer)clearTimeout(scanTimer);
if(!input){
lastFindings=[];
lastPlain='';
showEmpty();
return;
}
document.getElementById('inputStatus').textContent='Scanning…';
scanTimer=setTimeout(render,220);
}
function showEmpty(){
document.getElementById('outputView').innerHTML=
'<div class="placeholder"><i class="fas fa-arrow-left"></i><p>Paste text to detect and scrub PII</p></div>';
document.getElementById('inputStatus').textContent='Ready · 100% client-side';
document.getElementById('inputStatus').className='';
document.getElementById('outputStatus').textContent='No data';
document.getElementById('outputStatus').className='';
document.getElementById('findingsBar').hidden=true;
}
function render(){
const text=document.getElementById('sourceInput').value;
document.getElementById('charCount').textContent=text.length.toLocaleString()+' characters';
if(!text){showEmpty();return;}
lastFindings=detectPII(text);
let html='';
let plain='';
let pos=0;
lastFindings.forEach((f,i)=>{
const before=text.slice(pos,f.start);
html+=escapeHtml(before);
plain+=before;
const display=transform(f.value,f.type);
const meta=TYPE_META[f.type];
html+='<mark class="pii t-'+f.type+'" id="pii-'+i+'" data-label="'+escapeHtml(meta.label)+'" title="'+escapeHtml(meta.label)+'">'+escapeHtml(display)+'</mark>';
plain+=display;
pos=f.end;
});
html+=escapeHtml(text.slice(pos));
plain+=text.slice(pos);
lastPlain=plain;
document.getElementById('outputView').innerHTML='<div class="output-pre">'+(html||'&nbsp;')+'</div>';
const counts={};
lastFindings.forEach(f=>{counts[f.type]=(counts[f.type]||0)+1;});
const bar=document.getElementById('findingsBar');
const types=Object.keys(counts);
if(!types.length){
bar.hidden=false;
bar.innerHTML='<span class="findings-label">Findings</span><span class="status-valid" style="font-size:0.8rem;"><i class="fas fa-check-circle"></i>No PII detected</span>';
document.getElementById('inputStatus').textContent='Scan complete';
document.getElementById('inputStatus').className='status-valid';
document.getElementById('outputStatus').textContent='0 findings · '+mode+' mode';
document.getElementById('outputStatus').className='status-valid';
return;
}
bar.hidden=false;
bar.innerHTML='<span class="findings-label">Findings</span>'+types.map(t=>{
const meta=TYPE_META[t];
return '<button type="button" class="chip" data-type="'+t+'" onclick="jumpToType(\''+t+'\')">'+
'<span class="chip-dot" style="background:'+meta.chip+'"></span>'+
escapeHtml(meta.label)+
'<span class="count">'+counts[t]+'</span></button>';
}).join('');
const n=lastFindings.length;
document.getElementById('inputStatus').textContent='Scan complete';
document.getElementById('inputStatus').className='status-warn';
document.getElementById('outputStatus').textContent=n+' finding'+(n===1?'':'s')+' · '+types.length+' type'+(types.length===1?'':'s')+' · '+mode+' mode';
document.getElementById('outputStatus').className='status-warn';
}
function jumpToType(type){
const idx=lastFindings.findIndex(f=>f.type===type);
if(idx<0)return;
const el=document.getElementById('pii-'+idx);
if(!el)return;
el.scrollIntoView({behavior:'smooth',block:'center'});
el.style.outline='2px solid var(--accent-color)';
setTimeout(()=>{el.style.outline='';},1400);
}
function copyOutput(){
if(!lastPlain){toast('Nothing to copy','error');return;}
navigator.clipboard.writeText(lastPlain).then(()=>toast('Copied scrubbed text')).catch(()=>{
const ta=document.createElement('textarea');
ta.value=lastPlain;
document.body.appendChild(ta);
ta.select();
document.execCommand('copy');
ta.remove();
toast('Copied scrubbed text');
});
}
function downloadOutput(){
if(!lastPlain){toast('Nothing to download','error');return;}
const blob=new Blob([lastPlain],{type:'text/plain;charset=utf-8'});
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
a.download=mode==='mask'?'masked.txt':'redacted.txt';
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
toast('Downloaded '+a.download);
}
function clearAll(){
document.getElementById('sourceInput').value='';
document.getElementById('fileInput').value='';
lastFindings=[];
lastPlain='';
showEmpty();
document.getElementById('charCount').textContent='0 characters';
}
function loadSample(){
const sample=[
'2026-08-31 14:22:01 INFO api.request ip=203.0.113.42 ipv6=2001:db8:85a3::8a2e:370:7334 user=jane.doe@example.com',
'2026-08-31 14:22:01b DEBUG session=Bearer exampletoken_notreal_abc123xyz',
'2026-08-31 14:22:02 WARN authorization:Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
'2026-08-31 14:22:03 ERROR billing declined pan=4111-1111-1111-1111 phone+=1-415-555-0134 alt+=44 20 7946 0958',
'2026-08-31 14:22:04 INFO hr.record ssn=123-45-6789 backup_contact=cathy@example.org',
'2026-08-31 14:22:05 DEBUG aws.access_key=AKIAIOSFODNN7EXAMPLE',
'2026-08-31 14:22:06 DEBUG github.pat=ghp_EXAMPLE_NOT_A_REAL_GITHUB_PAT_xx',
'2026-08-31 14:22:07 DEBUG github.fine_grained=github_pat_EXAMPLE_NOT_A_REAL_FINE_GRAINED_TOKEN',
'2026-08-31 14:22:08 DEBUG slack.bot=xoxb-EXAMPLE-NOT-A-REAL-TOKEN',
'2026-08-31 14:22:09 DEBUG entropy.b64=dGhpc2lzYWZha2ViYXNlNjRzZWNyZXRmb3JkZW1vMTIz entropy.hex=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
'2026-08-31 14:22:10 DEBUG tls.pem=',
'-----BEGIN PRIVATE KEY-----',
'MIIBUwIBADANBgkqhkiG9w0BAQEFAASCAT0wggE5AgEAAkEA-EXAMPLE-NOT-A-REAL-KEY',
'-----END PRIVATE KEY-----',
'2026-08-31 14:22:11 INFO note=All values above are documented fakes/reserved examples.'
].join('\n');
document.getElementById('sourceInput').value=sample;
render();
toast('Loaded sample log(fake data only)');
}
function onFilePicked(ev){
const file=ev.target.files&&ev.target.files[0];
if(file)loadFile(file);
ev.target.value='';
}
function loadFile(file){
if(file.size>2*1024*1024){
toast('File too large(max 2 MB)','error');
return;
}
const okExt/=\.(txt|json|csv|log|text|md|yml|yaml|env)$/i.test(file.name);
if(!okExt&&file.type&&!file.type.startsWith('text/')&&file.type!=='application/json'){
toast('Please drop a text-like file(.txt .json .csv .log)','error');
return;
}
const reader=new FileReader();
reader.onload=()=>{
document.getElementById('sourceInput').value=String(reader.result||'');
render();
toast('Loaded '+file.name);
};
reader.onerror=()=>toast('Could not read file','error');
reader.readAsText(file);
}
document.addEventListener('DOMContentLoaded',function(){
loadTheme();
const input=document.getElementById('sourceInput');
input.addEventListener('input',scheduleScan);
let dragDepth=0;
const overlay=document.getElementById('dropOverlay');
function hasFiles(e){
return e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
}
document.addEventListener('dragenter',e=>{
if(!hasFiles(e))return;
e.preventDefault();
dragDepth++;
overlay.classList.add('active');
});
document.addEventListener('dragleave',e=>{
if(!hasFiles(e)&&dragDepth===0)return;
dragDepth=Math.max(0,dragDepth-1);
if(dragDepth===0)overlay.classList.remove('active');
});
document.addEventListener('dragover',e=>{
if(hasFiles(e))e.preventDefault();
});
document.addEventListener('drop',e=>{
if(!hasFiles(e))return;
e.preventDefault();
dragDepth=0;
overlay.classList.remove('active');
const file=e.dataTransfer.files&&e.dataTransfer.files[0];
if(file)loadFile(file);
});
document.addEventListener('keydown',function(e){
const meta=e.ctrlKey||e.metaKey;
if(meta&&e.key==='Enter'){e.preventDefault();render();}
if(meta&&e.key.toLowerCase()==='o'){e.preventDefault();document.getElementById('fileInput').click();}
if(meta&&e.shiftKey&&e.key.toLowerCase()==='c'){e.preventDefault();copyOutput();}
if(meta&&e.shiftKey&&e.key.toLowerCase()==='s'){e.preventDefault();downloadOutput();}
});
});
