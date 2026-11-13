(() => {
  'use strict';
  // B04: manually initiated case only. This page is intentionally not linked
  // from the main site. No security assumption depends on hiding this URL.
  // The authorization is the server-verified, one-time 256-bit email code.
  const conf=window.DIGITALIS_BIZALOM_SITE;
  const form=document.getElementById('email-change-form');
  const field=document.getElementById('email-change-code');
  const button=document.getElementById('email-change-submit');
  const feedback=document.getElementById('email-change-feedback');
  function message(text, kind='') {
    feedback.textContent=text;
    feedback.className='feedback'+(kind?' feedback-'+kind:'');
    feedback.focus({preventScroll:true});
  }
  if (!conf || !/^https:\/\//.test(conf.apiBase)) {
    button.disabled=true;
    message('A megerősítés jelenleg nem érhető el.','error');
    return;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (!form.reportValidity()) return;
    const code=field.value.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(code)) {
      message('A kód formátuma nem megfelelő.','error');return;
    }
    button.disabled=true;
    message('A megerősítés ellenőrzése…');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(conf.apiBase.replace(/\/$/,'')+'/confirmation/email-change',{
        method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({code}),signal:controller.signal
      });
      const data=await response.json().catch(()=>null);
      if(response.status===200 && data?.state==='pending_review') {
        field.value='';
        message('Az új emailcím megerősítése sikerült. A változtatás moderációra vár.','success');
      } else if(response.status===429) {
        message('Túl sok próbálkozás történt. Próbáld később.','error');
      } else if(response.status===400 || response.status===403) {
        message('A megadott kód érvénytelen, lejárt vagy már felhasználták.','error');
      } else {
        message('A megerősítés jelenleg nem sikerült. Kérjük, próbáld később.','error');
      }
    }catch{
      message('Hálózati hiba. A megerősítés állapota bizonytalan; ellenőrizd az ügyet, mielőtt újra próbálkozol.','error');
    }finally{
      clearTimeout(timer);button.disabled=false;
    }
  });
})();
