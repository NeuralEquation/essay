'use strict';
// Bump VERSION when deploying changes to the offline app shell.
const VERSION = 'v1';
const PREFIX = 'eiken-body-trainer:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const base = self.registration.scope;
const assets = ['index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'].map(p=>new URL(p,base).href);
const shell = assets[0];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(assets.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==new URL(base).origin)return;
  const isHome=req.mode==='navigate'&&(url.pathname===new URL(base).pathname||url.pathname===new URL(shell).pathname);
  if(isHome){
    // Keep each offline version coherent; fetch updates through the worker lifecycle.
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(shell))||fetch(req)));
  }else if(assets.includes(url.href)){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(req))||fetch(req)));
  }
});
