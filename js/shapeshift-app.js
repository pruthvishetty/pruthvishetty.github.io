let currentTheme='light';
let currentTab='ts';
let lastGen={ts:'',py:'',zod:''};
let lastOk=false;
let inferTimer=null;
let typeCount=0;
const PY_KEYWORDS=new Set(['False','None','True','and','as','assert','async','await','break','class','continue','def','del','elif','else','except','finally','for','from','global','if','import','in','is','lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield','match','case','type']);
function toggleTheme(){
currentTheme=currentTheme==='light'?'dark':'light';
document.body.setAttribute('data-theme',currentTheme);
document.querySelector('.theme-toggle i').className=currentTheme==='light'?'fas fa-moon':'fas fa-sun';
localStorage.setItem('shapeshift-theme',currentTheme);
localStorage.setItem('tools-theme',currentTheme);
}
function loadTheme(){
const saved=localStorage.getItem('tools-theme')||localStorage.getItem('shapeshift-theme')||localStorage.getItem('jsonviz-theme')||'light';
currentTheme=saved;
document.body.setAttribute('data-theme',currentTheme);
document.querySelector('.theme-toggle i').className=currentTheme==='light'?'fas fa-moon':'fas fa-sun';
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
function toPascal(s){
const parts=String(s||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
const name=parts.map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('');
return name.replace(/^[0-9]/,'_$&')||'Object';
}
function singularize(s){
const x=String(s||'');
if(/ies$/i.test(x)&&x.length>4)return x.slice(0,-3)+'y';
if(/(sses|shes|ches|xes)$/i.test(x))return x.slice(0,-2);
if(/s$/i.test(x)&&!/ss$/i.test(x)&&x.length>3)return x.slice(0,-1);
return x;
}
function identOk(s){return/^[A-Za-z_][A-Za-z0-9_]*$/.test(s);}
function pyField(key){
let name=String(key).replace(/[^0-9A-Za-z_]/g,'_');
if(/^[0-9]/.test(name))name='field_'+name;
if(!name)name='field';
if(PY_KEYWORDS.has(name))name+='_';
return name;
}
function cloneType(t){
if(!t)return t;
const c={kind:t.kind,optional:t.optional,nullable:t.nullable};
if(t.fields){
c.fields={};
Object.keys(t.fields).forEach(k=>{c.fields[k]=cloneType(t.fields[k]);});
}
if(t.element)c.element=cloneType(t.element);
if(t.members)c.members=t.members.map(cloneType);
return c;
}
function infer(value){
if(value===null)return{kind:'null'};
if(Array.isArray(value)){
if(!value.length)return{kind:'array',element:{kind:'unknown'}};
let el=infer(value[0]);
for(let i=1;i<value.length;i++)el=mergeTypes(el,infer(value[i]));
return{kind:'array',element:el};
}
const ty=typeof value;
if(ty==='string')return{kind:'string'};
if(ty==='boolean')return{kind:'boolean'};
if(ty==='number')return{kind:Number.isInteger(value)?'int':'number'};
if(ty==='object'){
const fields={};
Object.keys(value).forEach(k=>{fields[k]=infer(value[k]);});
return{kind:'object',fields};
}
return{kind:'unknown'};
}
function coreEqual(a,b){
if(!a||!b||a.kind!==b.kind)return false;
if(a.kind==='array')return coreEqual(a.element,b.element);
if(a.kind==='object'){
const ak=Object.keys(a.fields),bk=Object.keys(b.fields);
if(ak.length!==bk.length)return false;
return ak.every(k=>b.fields[k]&&coreEqual(a.fields[k],b.fields[k])&&
!!a.fields[k].optional===!!b.fields[k].optional&&
!!a.fields[k].nullable===!!b.fields[k].nullable);
}
if(a.kind==='union'){
if(a.members.length!==b.members.length)return false;
return a.members.every(m=>b.members.some(n=>coreEqual(m,n)));
}
return true;
}
function flattenUnion(t){
if(!t)return[];
if(t.kind==='union')return t.members.flatMap(flattenUnion);
return[t];
}
function mergeTypes(a,b){
if(!a)return cloneType(b);
if(!b)return cloneType(a);
if(a.kind==='unknown')return mark(cloneType(b),a);
if(b.kind==='unknown')return mark(cloneType(a),b);
if(a.kind==='null'&&b.kind==='null')return{kind:'null',optional:a.optional||b.optional};
if(a.kind==='null'){const c=cloneType(b);c.nullable=true;c.optional=a.optional||b.optional||c.optional;return c;}
if(b.kind==='null'){const c=cloneType(a);c.nullable=true;c.optional=a.optional||b.optional||c.optional;return c;}
if((a.kind==='int'&&b.kind==='number')||(a.kind==='number'&&b.kind==='int')){
return{kind:'number',optional:a.optional||b.optional,nullable:a.nullable||b.nullable};
}
if(a.kind==='object'&&b.kind==='object'){
const keys=new Set([...Object.keys(a.fields),...Object.keys(b.fields)]);
const fields={};
keys.forEach(k=>{
const fa=a.fields[k],fb=b.fields[k];
if(!fa){fields[k]=cloneType(fb);fields[k].optional=true;}
else if(!fb){fields[k]=cloneType(fa);fields[k].optional=true;}
else{fields[k]=mergeTypes(fa,fb);}
});
return{kind:'object',fields,optional:a.optional||b.optional,nullable:a.nullable||b.nullable};
}
if(a.kind==='array'&&b.kind==='array'){
return{kind:'array',element:mergeTypes(a.element,b.element),optional:a.optional||b.optional,nullable:a.nullable||b.nullable};
}
if(coreEqual(stripFlags(a),stripFlags(b))){
return{...cloneType(a),optional:a.optional||b.optional,nullable:a.nullable||b.nullable};
}
const members=uniqueMembers([...flattenUnion(a),...flattenUnion(b)]);
const nonNull=members.filter(m=>m.kind!=='null');
const hadNull=members.length!==nonNull.length||a.nullable||b.nullable;
if(nonNull.length===1){
const c=cloneType(nonNull[0]);
c.nullable=hadNull||c.nullable;
c.optional=a.optional||b.optional||c.optional;
return c;
}
const objs=nonNull.filter(m=>m.kind==='object');
const rest=nonNull.filter(m=>m.kind!=='object');
if(objs.length>=2&&rest.length===0){
let merged=objs[0];
for(let i=1;i<objs.length;i++)merged=mergeTypes(merged,objs[i]);
merged.nullable=hadNull||merged.nullable;
merged.optional=a.optional||b.optional||merged.optional;
return merged;
}
if(objs.length>=2){
let merged=objs[0];
for(let i=1;i<objs.length;i++)merged=mergeTypes(merged,objs[i]);
const union=uniqueMembers([merged,...rest]);
return{kind:'union',members:union,nullable:hadNull,optional:a.optional||b.optional};
}
return{kind:'union',members:nonNull,nullable:hadNull,optional:a.optional||b.optional};
}
function mark(t,other){
t.optional=t.optional||other.optional;
t.nullable=t.nullable||other.nullable;
return t;
}
function stripFlags(t){
const c=cloneType(t);
delete c.optional;
delete c.nullable;
return c;
}
function uniqueMembers(list){
const out=[];
list.forEach(t=>{
if(!out.some(x=>coreEqual(stripFlags(x),stripFlags(t))&&!!x.optional===!!t.optional&&!!x.nullable===!!t.nullable)){
const hit=out.find(x=>coreEqual(stripFlags(x),stripFlags(t)));
if(hit){
hit.optional=hit.optional||t.optional;
hit.nullable=hit.nullable||t.nullable;
}else out.push(cloneType(t));
}
});
return out;
}
function uniquify(base,used){
let n=base||'Type';
if(!used.has(n)){used.add(n);return n;}
let i=2;
while(used.has(n+i))i++;
used.add(n+i);
return n+i;
}
function assignNames(node,hint,used){
if(!node)return;
if(node.kind==='object'){
node.name=uniquify(toPascal(hint),used);
Object.keys(node.fields).forEach(k=>assignNames(node.fields[k],k,used));
}else if(node.kind==='array'){
const itemHint=singularize(hint);
assignNames(node.element,itemHint===hint?hint+'Item':itemHint,used);
}else if(node.kind==='union'){
node.members.forEach((m,i)=>assignNames(m,hint+(m.kind==='object'?'':String(i+1)),used));
}
}
function collectObjects(node,out){
if(!node)return;
if(node.kind==='object'){
Object.values(node.fields).forEach(v=>collectObjects(v,out));
out.push(node);
}else if(node.kind==='array'){
collectObjects(node.element,out);
}else if(node.kind==='union'){
node.members.forEach(m=>collectObjects(m,out));
}
}
function withNull(s,node){
if(node&&node.nullable&&node.kind!=='null')return s+'|null';
return s;
}
function tsExpr(node){
if(!node)return 'unknown';
let t;
switch(node.kind){
case 'string':t='string';break;
case 'int':
case 'number':t='number';break;
case 'boolean':t='boolean';break;
case 'null':t='null';break;
case 'unknown':t='unknown';break;
case 'object':t=node.name;break;
case 'array':{
const inner=tsExpr(node.element);
t=node.element.kind==='union'||inner.includes('|')?'('+inner+')[]':inner+'[]';
break;
}
case 'union':t=node.members.map(tsExpr).join('|');break;
default:t='unknown';
}
return withNull(t,node);
}
function tsKey(k){return identOk(k)?k:JSON.stringify(k);}
function emitTS(root,objects,rootName){
const lines=['//Generated by ShapeShift. Review before use.',''];
objects.forEach(obj=>{
lines.push('export interface '+obj.name+'{');
const keys=Object.keys(obj.fields);
if(!keys.length)lines.push('[key:string]:never;');
keys.forEach(k=>{
const f=obj.fields[k];
const opt=f.optional?'?':'';
lines.push(' '+tsKey(k)+opt+':'+tsExpr(f)+';');
});
lines.push('}','');
});
if(root.kind!=='object'){
lines.push('export type '+rootName+'='+tsExpr(root)+';','');
}
return lines.join('\n').trim()+'\n';
}
function pyExpr(node){
if(!node)return 'Any';
let t;
switch(node.kind){
case 'string':t='str';break;
case 'int':t='int';break;
case 'number':t='float';break;
case 'boolean':t='bool';break;
case 'null':t='None';break;
case 'unknown':t='Any';break;
case 'object':t=node.name;break;
case 'array':t='list['+pyExpr(node.element)+']';break;
case 'union':t=node.members.map(pyExpr).join('|');break;
default:t='Any';
}
if(node.nullable&&node.kind!=='null')t=t+'|None';
return t;
}
function emitPy(root,objects,rootName){
let needField=false;
let needAny=false;
function walk(n){
if(!n)return;
if(n.kind==='unknown')needAny=true;
if(n.kind==='object'){
Object.keys(n.fields).forEach(k=>{
if(pyField(k)!==k)needField=true;
walk(n.fields[k]);
});
}else if(n.kind==='array')walk(n.element);
else if(n.kind==='union')n.members.forEach(walk);
}
objects.forEach(walk);
walk(root);
if(root.kind==='unknown'||(root.kind==='array'&&root.element.kind==='unknown'))needAny=true;
const lines=['# Generated by ShapeShift. Review before use.','from pydantic import BaseModel'+(needField?',Field':'')];
if(needAny)lines.push('from typing import Any');
lines.push('');
objects.forEach(obj=>{
lines.push('class '+obj.name+'(BaseModel):');
const keys=Object.keys(obj.fields);
if(!keys.length)lines.push(' pass');
keys.forEach(k=>{
const f=obj.fields[k];
const fname=pyField(k);
let ann=pyExpr(f);
const bits=[];
if(f.optional){
if(!ann.endsWith('|None')&&f.kind!=='null')ann=ann+'|None';
bits.push('None');
}
if(fname!==k)bits.push('Field('+(f.optional?'default=None,':'')+'alias='+JSON.stringify(k)+')');
let rhs='';
if(bits.length===1&&bits[0]==='None')rhs='=None';
else if(bits.length)rhs=bits[0].startsWith('Field')?'='+bits[0]:'='+bits[0];
if(fname!==k&&!String(rhs).includes('Field')){
rhs='=Field('+(f.optional?'default=None,':'')+'alias='+JSON.stringify(k)+')';
}
lines.push(' '+fname+':'+ann+rhs);
});
lines.push('');
});
if(root.kind!=='object'){
lines.push(rootName+'='+pyExpr(root));
lines.push('');
}
return lines.join('\n').trim()+'\n';
}
function zodExpr(node){
if(!node)return 'z.unknown()';
let t;
switch(node.kind){
case 'string':t='z.string()';break;
case 'int':t='z.number().int()';break;
case 'number':t='z.number()';break;
case 'boolean':t='z.boolean()';break;
case 'null':t='z.null()';break;
case 'unknown':t='z.unknown()';break;
case 'object':t=node.name+'Schema';break;
case 'array':t='z.array('+zodExpr(node.element)+')';break;
case 'union':
t=node.members.length===1?zodExpr(node.members[0])
:'z.union(['+node.members.map(zodExpr).join(',')+'])';
break;
default:t='z.unknown()';
}
if(node.nullable&&node.kind!=='null')t+='.nullable()';
if(node.optional)t+='.optional()';
return t;
}
function emitZod(root,objects,rootName){
const lines=[
'//Generated by ShapeShift. Review before use.',
'import{z}from "zod";',
''
];
objects.forEach(obj=>{
lines.push('export const '+obj.name+'Schema=z.object({');
const keys=Object.keys(obj.fields);
keys.forEach((k,i)=>{
const f=obj.fields[k];
const key=identOk(k)?k:JSON.stringify(k);
const comma=i<keys.length-1?',':'';
lines.push(' '+key+':'+zodExpr(f)+comma);
});
lines.push('});');
lines.push('export type '+obj.name+'=z.infer<typeof '+obj.name+'Schema>;');
lines.push('');
});
if(root.kind!=='object'){
lines.push('export const '+rootName+'Schema='+zodExpr(root)+';');
lines.push('export type '+rootName+'=z.infer<typeof '+rootName+'Schema>;');
lines.push('');
}
return lines.join('\n').trim()+'\n';
}
function highlight(code,lang){
let html=escapeHtml(code);
if(lang==='py'){
html=html.replace(/(^|\n)(#.*)/g,'$1<span class="cm">$2</span>');
html=html.replace(/\b(from|import|class|pass|None|True|False|Any)\b/g,'<span class="kw">$1</span>');
html=html.replace(/\b(BaseModel|Field|str|int|float|bool|list)\b/g,'<span class="ty">$1</span>');
}else{
html=html.replace(/(^|\n)(\/\/.*)/g,'$1<span class="cm">$2</span>');
html=html.replace(/\b(export|interface|type|import|from|const|infer|typeof)\b/g,'<span class="kw">$1</span>');
html=html.replace(/\b(string|number|boolean|null|unknown|never)\b/g,'<span class="ty">$1</span>');
html=html.replace(/\b(z)\b/g,'<span class="nm">$1</span>');
}
html=html.replace(/(&quot;.*?&quot;)/g,'<span class="st">$1</span>');
return html;
}
function sanitizeRootName(raw){
const p=toPascal(raw||'Root');
return p||'Root';
}
function generate(){
const input=document.getElementById('jsonInput').value;
document.getElementById('charCount').textContent=input.trim().length.toLocaleString()+' characters';
if(!input.trim()){
lastOk=false;
lastGen={ts:'',py:'',zod:''};
typeCount=0;
document.getElementById('codeOutput').innerHTML='<div class="placeholder"><i class="fas fa-arrow-left"></i><p>Enter JSON to generate types</p></div>';
document.getElementById('inputStatus').textContent='Ready to infer types';
document.getElementById('inputStatus').className='';
document.getElementById('outputStatus').textContent='No data';
document.getElementById('outputStatus').className='';
document.getElementById('typeCount').textContent='0 types';
return;
}
let data;
try{
data=JSON.parse(input);
}catch(err){
lastOk=false;
lastGen={ts:'',py:'',zod:''};
typeCount=0;
document.getElementById('codeOutput').innerHTML=
'<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div><strong>Invalid JSON</strong><br><code>'+
escapeHtml(err.message)+'</code></div></div>';
document.getElementById('inputStatus').textContent='Invalid JSON:'+err.message;
document.getElementById('inputStatus').className='status-invalid';
document.getElementById('outputStatus').textContent='Parse error';
document.getElementById('outputStatus').className='status-invalid';
document.getElementById('typeCount').textContent='0 types';
return;
}
const rootName=sanitizeRootName(document.getElementById('rootName').value);
const tree=infer(data);
const used=new Set();
assignNames(tree,tree.kind==='object'?rootName:(singularize(rootName)===rootName?rootName+'Item':rootName),used);
if(tree.kind==='object'){
used.delete(tree.name);
tree.name=rootName;
used.add(rootName);
}
const objects=[];
collectObjects(tree,objects);
typeCount=objects.length+(tree.kind==='object'?0:1);
lastGen={
ts:emitTS(tree,objects,rootName),
py:emitPy(tree,objects,rootName),
zod:emitZod(tree,objects,rootName)
};
lastOk=true;
paint();
document.getElementById('inputStatus').textContent='Valid JSON';
document.getElementById('inputStatus').className='status-valid';
document.getElementById('outputStatus').textContent='Inferred '+currentTabLabel();
document.getElementById('outputStatus').className='status-valid';
document.getElementById('typeCount').textContent=typeCount+(typeCount===1?' type':' types');
}
function currentTabLabel(){
return currentTab==='ts'?'TypeScript':currentTab==='py'?'Pydantic v2':'Zod';
}
function paint(){
const out=document.getElementById('codeOutput');
if(!lastOk)return;
const src=lastGen[currentTab]||'';
const lang=currentTab==='py'?'py':'ts';
out.innerHTML=highlight(src,lang);
}
function setTab(tab){
currentTab=tab;
document.querySelectorAll('.tab-btn').forEach(btn=>{
const on=btn.getAttribute('data-tab')===tab;
btn.classList.toggle('active',on);
btn.setAttribute('aria-selected',on?'true':'false');
});
if(lastOk){
paint();
document.getElementById('outputStatus').textContent='Inferred '+currentTabLabel();
}
}
function schedule(){
if(inferTimer)clearTimeout(inferTimer);
inferTimer=setTimeout(generate,250);
}
function copyOutput(){
const src=lastGen[currentTab];
if(!src){toast('Nothing to copy','error');return;}
navigator.clipboard.writeText(src).then(()=>toast('Copied '+currentTabLabel())).catch(()=>{
const ta=document.createElement('textarea');
ta.value=src;
document.body.appendChild(ta);
ta.select();
document.execCommand('copy');
ta.remove();
toast('Copied '+currentTabLabel());
});
}
function downloadOutput(){
const src=lastGen[currentTab];
if(!src){toast('Nothing to download','error');return;}
const root=sanitizeRootName(document.getElementById('rootName').value);
const name=currentTab==='py'?root+'.py':currentTab==='zod'?root+'.zod.ts':root+'.ts';
const mime=currentTab==='py'?'text/x-python':'text/plain';
const blob=new Blob([src],{type:mime+';charset=utf-8'});
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
a.download=name;
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
toast('Downloaded '+name);
}
function formatJSON(){
const input=document.getElementById('jsonInput');
const v=input.value.trim();
if(!v)return;
try{
input.value=JSON.stringify(JSON.parse(v),null,2);
generate();
toast('Formatted JSON');
}catch(err){
toast('Cannot format invalid JSON','error');
}
}
function clearAll(){
document.getElementById('jsonInput').value='';
generate();
}
function loadSample(){
const sample={
id:42,
name:"Acme Cloud",
active:true,
score:3.14,
owner:null,
tags:["saas","b2b"],
settings:{
theme:"dark",
limits:{maxUsers:100,maxStorageGb:50.5}
},
members:[
{id:1,name:"Ada",role:"admin",email:"ada@example.com"},
{id:2,name:"Bob",role:"viewer"}
],
events:[1,"ok",null],
matrix:[[1,2],[3,4]],
"kebab-case":"aliased"
};
document.getElementById('jsonInput').value=JSON.stringify(sample,null,2);
generate();
toast('Loaded sample JSON');
}
document.addEventListener('DOMContentLoaded',function(){
loadTheme();
document.getElementById('jsonInput').addEventListener('input',schedule);
document.getElementById('rootName').addEventListener('input',schedule);
document.addEventListener('keydown',function(e){
const meta=e.ctrlKey||e.metaKey;
if(meta&&e.key==='Enter'){e.preventDefault();generate();}
if(meta&&e.shiftKey&&e.key.toLowerCase()==='c'){e.preventDefault();copyOutput();}
if(meta&&e.shiftKey&&e.key.toLowerCase()==='s'){e.preventDefault();downloadOutput();}
});
});
