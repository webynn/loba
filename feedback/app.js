const form=document.getElementById('feedback');
let locale=navigator.language.startsWith('fr')?'fr':'en';
const words=(en,fr)=>locale==='fr'?fr:en;
function translate(){document.documentElement.lang=locale;document.querySelectorAll('[data-en]').forEach(el=>el.textContent=el.dataset[locale]);document.getElementById('language').textContent=locale==='fr'?'English':'Français';}
document.getElementById('language').onclick=()=>{locale=locale==='fr'?'en':'fr';translate();};translate();
let images=[], preparing=false;
const picker=document.getElementById('image-picker'), dropzone=document.getElementById('dropzone');
function previews(){const container=document.getElementById('image-previews');container.replaceChildren();images.forEach((src,index)=>{const figure=document.createElement('figure'),img=document.createElement('img'),remove=document.createElement('button');img.src=src;img.alt=words('Attachment ','Image jointe ')+(index+1);remove.type='button';remove.textContent=words('Remove','Retirer');remove.disabled=preparing||form.querySelector('[type=submit]').disabled;remove.onclick=()=>{images.splice(index,1);if(!images.length)document.getElementById('image-status').textContent='';previews();};figure.append(img,remove);container.append(figure);});}
async function addImages(files){
 if(preparing||form.querySelector('[type=submit]').disabled)return;
 preparing=true;picker.disabled=true;form.querySelector('[type=submit]').disabled=true;previews();
 const note=document.getElementById('image-status');note.textContent=words('Preparing images…','Préparation des images…');const errors=[];
 for(const file of files){
  if(images.length>=3){errors.push(words('Maximum 3 images.','Maximum 3 images.'));break;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){errors.push(words('Use JPEG, PNG or WebP images under 10 MB.','Utilise JPEG, PNG ou WebP de moins de 10 Mo.'));continue;}
  const url=URL.createObjectURL(file);
  try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,2000/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const encoded=canvas.toDataURL('image/jpeg',.85);if(encoded.length>2800000)throw new Error();images.push(encoded);}catch{errors.push(words('An image could not be read. Try another photo.','Une image est illisible. Essaie une autre photo.'));}finally{URL.revokeObjectURL(url);}
 }
 preparing=false;picker.disabled=false;form.querySelector('[type=submit]').disabled=false;picker.value='';previews();note.textContent=errors.length?errors.join(' '):words('Images ready. They’ll be sent with your feedback.','Images prêtes. Elles seront envoyées avec ton retour.');
}
picker.onchange=()=>addImages(Array.from(picker.files));
for(const event of ['dragenter','dragover'])dropzone.addEventListener(event,e=>{e.preventDefault();dropzone.classList.add('dragging');});
for(const event of ['dragleave','drop'])dropzone.addEventListener(event,e=>{e.preventDefault();dropzone.classList.remove('dragging');});
dropzone.addEventListener('drop',e=>addImages(Array.from(e.dataTransfer.files)));
form.onsubmit=async event=>{event.preventDefault();if(preparing)return;const button=form.querySelector('[type=submit]'),result=document.getElementById('result');button.disabled=true;picker.disabled=true;previews();result.textContent=words('Sending…','Envoi…');try{const data=Object.fromEntries(new FormData(form));data.consent=form.elements.consent.checked;data.images=images.map(src=>src.split(',')[1]);const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!response.ok)throw new Error(response.status===429?words('Too many submissions. Please try again in 15 minutes.','Trop d’envois. Réessaie dans 15 minutes.'):words('Unable to send. Your text is still here; please try again.','Envoi impossible. Ton texte est conservé ; réessaie.'));const saved=await response.json();result.textContent=words('Thank you! Your feedback is saved. Reference: ','Merci ! Ton retour est enregistré. Référence : ')+saved.id.slice(0,8);form.reset();images=[];document.getElementById('image-status').textContent='';}catch(error){result.textContent=error.message;}finally{button.disabled=false;picker.disabled=false;previews();}};
