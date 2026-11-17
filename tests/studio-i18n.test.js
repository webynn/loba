import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../admin/i18n.js',import.meta.url),'utf8');
function setup(saved, blocked=false){
 const handlers={}; const storage=new Map(saved?[['loba-studio-language',saved]]:[]);
 const document={documentElement:{lang:''},querySelectorAll:()=>[],addEventListener:(name,fn)=>handlers[name]=fn,dispatchEvent:()=>{}};
 const context=vm.createContext({document,Event:class{},localStorage:{getItem:k=>{if(blocked)throw Error();return storage.get(k)},setItem:(k,v)=>{if(blocked)throw Error();storage.set(k,v)}}});
 vm.runInContext(source,context);
 return {get:expression=>vm.runInContext(expression,context),document,storage,switchTo:lang=>handlers.click({target:{closest:()=>({dataset:{uiLang:lang}})}})};
}
test('Studio defaults to French even without browser storage',()=>{
 for(const blocked of [false,true]){const app=setup(undefined,blocked);assert.equal(app.document.documentElement.lang,'fr');assert.equal(app.get('StudioI18n.t("New lesson")'),'Nouvelle leçon');}
});
test('Studio switches language, persists it and restores English on reload',()=>{
 const app=setup();app.switchTo('en');assert.equal(app.get('StudioI18n.t("New lesson")'),'New lesson');assert.equal(app.storage.get('loba-studio-language'),'en');
 assert.equal(setup(app.storage.get('loba-studio-language')).document.documentElement.lang,'en');
 app.switchTo('fr');assert.equal(app.get('StudioI18n.t("Email or password is incorrect.")'),'L’adresse e-mail ou le mot de passe est incorrect.');
});
test('Studio translates placeholders and validation messages without changing content',()=>{
 const app=setup();assert.equal(app.get('StudioI18n.t("Unit {n}",{n:4})'),'Unité 4');assert.equal(app.get('StudioI18n.t("Mbote ɛ ɔ")'),'Mbote ɛ ɔ');
 assert.match(app.get('StudioI18n.t("Title is required and must be at most 160 characters.")'),/Titre.*160 caractères/);
});
