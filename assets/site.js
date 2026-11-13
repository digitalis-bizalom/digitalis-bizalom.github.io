(() => {
  'use strict';
  const config = window.DIGITALIS_BIZALOM_SITE;
  if (!config || !/^https:\/\//.test(config.apiBase)) return;
  const BASE = config.apiBase.replace(/\/$/, '');
  const $ = (id) => document.getElementById(id);
  const founderNames = new Set(['Nagymajtényi Gábor', 'Frész Ferenc', 'Mázsa Péter']);
  const state = {loading: false, signatories: [], generation: null, nextOffset: null,
    turnstileToken: '', turnstileId: null, signingOpen: false};

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(BASE + path, {
        method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'cors',
        ...options, signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      return {status: response.status, ok: response.ok, data};
    } finally { clearTimeout(timer); }
  }

  function line(className, label) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = label;
    return span;
  }

  function renderNames() {
    const authors = $('founders-live');
    const others = $('others-live');
    authors.replaceChildren();
    others.replaceChildren();
    const activeFounders = [];
    const activeOthers = [];
    let reachedOther = false;
    for (const item of state.signatories) {
      // The API guarantees founder rows first, but does not export role.
      // Only matching names at the beginning are classified as founders.
      if (!reachedOther && founderNames.has(item.name)) activeFounders.push(item);
      else {reachedOther = true; activeOthers.push(item);}
    }
    for (const [items, root] of [[activeFounders,authors],[activeOthers,others]]) {
      for (const entry of items) {
        const li = document.createElement('li');
        li.className = 'signatory-item';
        li.append(line('signatory-name',entry.name));
        const metadata = [];
        if (entry.profession) metadata.push(entry.profession);
        if (entry.affiliation) metadata.push(entry.affiliation);
        if (metadata.length) li.append(line('signatory-meta',metadata.join(' · ')));
        if (entry.date) li.append(line('signatory-date',entry.date.replaceAll('-', '. ')+'.'));
        root.append(li);
      }
    }
    $('founders-heading').hidden = activeFounders.length === 0;
    $('others-block').hidden = activeOthers.length === 0;
    $('public-list').hidden = false;
    $('authors-static').hidden = true;
    $('more-signatories').hidden = state.nextOffset === null;
  }

  async function getPage(offset, generation = null) {
    const params = new URLSearchParams({offset: String(offset), limit: '100'});
    if (offset > 0 && generation !== null) params.set('generation',String(generation));
    return api('/public/signatories?' + params);
  }

  async function refreshPublic() {
    if (state.loading) return;
    state.loading = true;
    $('refresh-public').disabled = true;
    $('public-status').textContent = 'Az aktuális aláírási adatok lekérdezése…';
    try {
      const [stats,list] = await Promise.all([api('/public/stats'),getPage(0)]);
      if (stats.status !== 200 || list.status !== 200 || !stats.data || !list.data ||
          stats.data.version !== 'v1.0' || list.data.version !== 'v1.0' ||
          stats.data.generation !== list.data.generation || !Array.isArray(list.data.signatories)) {
        $('public-status').textContent = 'A nyilvános aláírás-nyilvántartás jelenleg nem elérhető.';
        $('public-updated').textContent = '';
        if (!state.signingOpen) $('signature-closed').textContent = 'Az online aláírásfogadás jelenleg nem elérhető.';
        return;
      }
      const count = stats.data;
      if (![count.total_signatures,count.public_names,count.without_public_name].every(Number.isInteger) ||
          count.public_names + count.without_public_name !== count.total_signatures) throw new Error('invalid_stats');
      $('stat-total').textContent = count.total_signatures.toLocaleString('hu-HU');
      $('stat-visible').textContent = count.public_names.toLocaleString('hu-HU');
      $('stat-hidden').textContent = count.without_public_name.toLocaleString('hu-HU');
      state.generation = count.generation;
      state.signatories = list.data.signatories;
      state.nextOffset = list.data.has_more ? list.data.next_offset : null;
      renderNames();
      $('public-status').textContent = 'A nyilvántartás aktuális adatai.';
      $('public-updated').textContent = 'Frissítve: ' + new Intl.DateTimeFormat('hu-HU',{
        hour:'2-digit',minute:'2-digit',timeZone:'Europe/Budapest'
      }).format(new Date());
      if (config.enableSigning && !state.signingOpen) openSigning();
    } catch {
      $('public-status').textContent = 'Az aláírási adatok most nem kérhetők le. Próbáld újra később.';
    } finally {
      state.loading = false;
      $('refresh-public').disabled = false;
    }
  }

  async function loadMore() {
    if (state.loading || state.nextOffset === null) return;
    state.loading = true;
    $('more-signatories').disabled = true;
    try {
      const page = await getPage(state.nextOffset,state.generation);
      if (page.status === 409) {
        await refreshAfterPageChange(); return;
      }
      if (!page.ok || page.data?.generation !== state.generation || !Array.isArray(page.data.signatories))
        throw new Error('invalid_page');
      state.signatories.push(...page.data.signatories);
      state.nextOffset = page.data.has_more ? page.data.next_offset : null;
      renderNames();
    } catch {
      $('public-status').textContent = 'A további aláírók most nem tölthetők be.';
    } finally {state.loading = false; $('more-signatories').disabled = false;}
  }
  async function refreshAfterPageChange() {
    state.loading = false;
    await refreshPublic();
    $('public-status').textContent = 'A lista közben frissült; az aktuális adatokat újratöltöttük.';
  }

  function feedback(el,text,kind='') {
    el.textContent = text;
    el.className = 'feedback' + (kind ? ' feedback-' + kind : '');
    if (text) el.focus({preventScroll:true});
  }
  function messageForError(status, code, confirmation=false) {
    if (status===429) return 'Túl sok próbálkozás történt. Várj, mielőtt újra próbálkozol.';
    if (status===403) return confirmation ? 'A kód érvénytelen vagy lejárt.' : 'Az automatikus ellenőrzés sikertelen. Próbáld újra.';
    if (status===400) return 'Ellenőrizd a megadott adatokat, majd próbáld újra.';
    if (status===503) return 'A szolgáltatás átmenetileg nem érhető el. Kérjük, próbáld később.';
    return 'A kérés most nem teljesíthető. Próbáld később.';
  }

  function adjustDisclosure() {
    const selected = document.querySelector('input[name="display_mode"]:checked')?.value;
    const show = selected==='full';
    $('extra-public-options').hidden = !show;
    if (!show) {
      $('publish-profession').checked=false;
      $('publish-affiliation').checked=false;
    }
  }
  function cleanupTurnstile() {
    state.turnstileToken='';
    if (window.turnstile && state.turnstileId!==null) {
      try {window.turnstile.reset(state.turnstileId);} catch { /* nothing */ }
    }
  }
  function loadTurnstile() {
    if (!config.turnstileSiteKey) return;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;
    script.onload=() => {
      if (!window.turnstile) return;
      try {
        state.turnstileId = window.turnstile.render('#turnstile-widget', {
          sitekey:config.turnstileSiteKey,
          action:config.turnstileAction,
          theme:'light',
          language:'hu',
          callback:(token)=>{state.turnstileToken=token;},
          'expired-callback':()=>{state.turnstileToken='';},
          'error-callback':()=>{state.turnstileToken='';}
        });
      } catch {feedback($('signature-feedback'),'Az ellenőrző modul jelenleg nem tölthető be.','error');}
    };
    script.onerror=()=>feedback($('signature-feedback'),'Az ellenőrző modul jelenleg nem tölthető be.','error');
    document.head.append(script);
  }
  function openSigning() {
    if (state.signingOpen) return;
    state.signingOpen=true;
    $('signature-closed').hidden=true;
    $('signature-open').hidden=false;
    loadTurnstile();
  }

  async function submitSignature(event) {
    event.preventDefault();
    const form=event.currentTarget;
    if (!form.reportValidity()) return;
    const selected=form.querySelector('input[name="display_mode"]:checked')?.value;
    if (!selected) return;
    const normalize = id => $(id).value.trim().normalize('NFC');
    const family=normalize('family-name'),given=normalize('given-name');
    const nameRule=/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
    if (!nameRule.test(family) || !nameRule.test(given)) {
      feedback($('signature-feedback'),'A családi név és az utónév csak névként használható karaktereket tartalmazhat.','error'); return;
    }
    const profession=normalize('profession'),affiliation=normalize('affiliation');
    const publishProfession=$('publish-profession').checked;
    const publishAffiliation=$('publish-affiliation').checked;
    if ((publishProfession && !profession) || (publishAffiliation && !affiliation)) {
      feedback($('signature-feedback'),'A nyilvános megjelenítéshez előbb add meg az érintett opcionális adatot.','error');return;
    }
    if (!state.turnstileToken) {
      feedback($('signature-feedback'),'Végezd el az automatikus beküldések elleni ellenőrzést.','error');return;
    }
    const payload={
      family_name:family, given_name:given, email:normalize('email'),display_mode:selected,
      profession:profession || null,affiliation:affiliation || null,
      publish_profession:publishProfession,publish_affiliation:publishAffiliation,
      consent_processing:$('consent-processing').checked,
      consent_public_display:selected!=='none',
      accept_statement:$('accept-statement').checked,
      turnstile_token:state.turnstileToken
    };
    $('signature-submit').disabled=true;
    feedback($('signature-feedback'),'A kérelem továbbítása…');
    try {
      const reply=await api('/signatures',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
      });
      if (reply.status===202 && reply.data?.ok===true) {
        feedback($('signature-feedback'),'A kérelmet fogadtuk. Ha feldolgozható, megerősítő kódot küldünk az email-címedre. A kódot az alábbi mezőben add meg.','success');
        $('confirmation-box').scrollIntoView({block:'nearest',behavior:'smooth'});
      } else {
        feedback($('signature-feedback'),messageForError(reply.status,reply.data?.error),'error');
      }
    } catch {
      feedback($('signature-feedback'),'Hálózati hiba történt. A kérelmed állapota bizonytalan; mielőtt újra próbálkozol, ellenőrizd az email-fiókodat.','error');
    } finally { cleanupTurnstile(); $('signature-submit').disabled=false; }
  }

  async function confirmCode(event) {
    event.preventDefault();
    const form=event.currentTarget;
    if (!form.reportValidity()) return;
    const code=$('confirmation-code').value.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(code)) {
      feedback($('confirmation-feedback'),'A megadott kód formátuma nem megfelelő.','error'); return;
    }
    $('confirmation-submit').disabled=true;
    feedback($('confirmation-feedback'),'Megerősítés ellenőrzése…');
    try {
      const reply=await api('/confirmation/complete',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})
      });
      if (reply.status===200 && reply.data?.state==='pending_review') {
        $('confirmation-code').value='';
        feedback($('confirmation-feedback'),'Az emailes megerősítés sikerült. Az aláírásod moderációra vár; még nem nyilvános.','success');
      } else feedback($('confirmation-feedback'),messageForError(reply.status,reply.data?.error,true),'error');
    } catch {feedback($('confirmation-feedback'),'Hálózati hiba. Ellenőrizd a kapcsolatodat, és próbáld újra.','error');}
    finally {$('confirmation-submit').disabled=false;}
  }

  $('refresh-public').addEventListener('click',refreshPublic);
  $('more-signatories').addEventListener('click',loadMore);
  document.querySelectorAll('input[name="display_mode"]').forEach(x=>x.addEventListener('change',adjustDisclosure));
  $('signature-form').addEventListener('submit',submitSignature);
  $('confirmation-form').addEventListener('submit',confirmCode);
  refreshPublic();
  // Near-current display without unnecessary fast polling.
  window.setInterval(refreshPublic,60000);
})();
