const $ = (id) => document.getElementById(id);
const NCBI = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('modeToggle').addEventListener('click', () => {
  const enabled = document.body.classList.toggle('professional');
  $('modeToggle').textContent = `Professional mode: ${enabled ? 'on' : 'off'}`;
});
async function ncbiJson(endpoint, params) {
  const url = NCBI + endpoint + '?' + new URLSearchParams({...params, retmode:'json'});
  const response = await fetch(url, {headers:{'Accept':'application/json'}});
  if (!response.ok) throw new Error(`The scientific service returned status code ${response.status}.`);
  return response.json();
}
function setStatus(id, message, type='') {
  const el = $(id); el.textContent = message; el.className = 'status-line' + (type ? ' '+type : '');
}
function taxonomyCard(item) {
  const scientific = item.scientificname || 'Name not provided';
  const rank = item.rank || 'Not specified';
  const taxid = item.taxid || item.uid || '';
  const lineage = item.lineage || 'Classification is not provided in the summary record';
  return `<article class="organism-card">
    <div class="organism-symbol">${esc(scientific.slice(0,1).toUpperCase())}</div>
    <div class="card-topline">NCBI Taxonomy record</div>
    <h3>${esc(scientific)}</h3><p class="latin">NCBI Taxonomy ID: ${esc(taxid)}</p>
    <p>Rank: ${esc(rank)}. Name and classification are from the scientific database.</p>
    <button class="text-button" type="button" data-taxid="${esc(taxid)}" data-name="${esc(scientific)}" data-rank="${esc(rank)}" data-lineage="${esc(lineage)}">Open record →</button>
  </article>`;
}
let activeTaxon = null;
$('organismSearch').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = $('organismQuery').value.trim();
  if (!query) return;
  $('searchButton').disabled = true;
  $('searchButton').textContent = 'Searching…';
  $('organismResults').innerHTML = '';
  $('emptyState').hidden = true;
  $('organismDetail').hidden = true;
  setStatus('searchStatus', 'Request sent to NCBI Taxonomy. Waiting for a response…');
  try {
    const found = await ncbiJson('esearch.fcgi', {db:'taxonomy', term:query, retmax:'12'});
    const ids = found.esearchresult?.idlist || [];
    if (!ids.length) {
      $('emptyState').hidden = false;
      setStatus('searchStatus', 'NCBI returned no matches. Try a scientific name or a shorter query.', 'success');
      return;
    }
    const summary = await ncbiJson('esummary.fcgi', {db:'taxonomy', id:ids.join(',')});
    const result = summary.result || {};
    const items = ids.map(id => result[id]).filter(Boolean);
    $('organismResults').innerHTML = items.map(taxonomyCard).join('');
    setStatus('searchStatus', `Records received: ${items.length}. Source: NCBI Taxonomy.`, 'success');
  } catch (error) {
    setStatus('searchStatus', 'Could not connect to NCBI. Check your internet connection and try again. Details: ' + error.message, 'error');
  } finally {
    $('searchButton').disabled = false;
    $('searchButton').textContent = 'Search NCBI';
  }
});
$('organismResults').addEventListener('click', event => {
  const button = event.target.closest('[data-taxid]');
  if (!button) return;
  activeTaxon = {taxid:button.dataset.taxid, name:button.dataset.name, rank:button.dataset.rank, lineage:button.dataset.lineage};
  $('detailTitle').textContent = activeTaxon.name;
  $('detailLatin').textContent = `NCBI Taxonomy ID: ${activeTaxon.taxid}`;
  $('detailGrid').innerHTML = `<div><small>Rank</small><b>${esc(activeTaxon.rank)}</b></div><div><small>Classification</small><b>${esc(activeTaxon.lineage)}</b></div><div><small>Source</small><b>NCBI Taxonomy</b></div>`;
  $('detailActions').innerHTML = `<a href="https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${encodeURIComponent(activeTaxon.taxid)}" target="_blank" rel="noopener noreferrer">Open original NCBI record ↗</a>`;
  $('sequenceResults').innerHTML = '';
  setStatus('sequenceStatus', '');
  $('organismDetail').hidden = false;
  $('organismDetail').scrollIntoView({behavior:'smooth', block:'start'});
});
$('closeDetail').addEventListener('click', () => {$('organismDetail').hidden = true;});
$('loadSequences').addEventListener('click', async () => {
  if (!activeTaxon) return;
  $('loadSequences').disabled = true;
  $('loadSequences').textContent = 'Loading…';
  $('sequenceResults').innerHTML = '';
  setStatus('sequenceStatus', 'Searching NCBI for nucleotide records. This is record search, not similarity analysis.');
  try {
    const term = `txid${activeTaxon.taxid}[Organism]`;
    const found = await ncbiJson('esearch.fcgi', {db:'nuccore', term, retmax:'10', sort:'relevance'});
    const ids = found.esearchresult?.idlist || [];
    if (!ids.length) {
      setStatus('sequenceStatus', 'No NCBI Nucleotide records were found for this taxon. You can check the taxonomy record directly.', 'success');
      return;
    }
    const summary = await ncbiJson('esummary.fcgi', {db:'nuccore', id:ids.join(',')});
    const result = summary.result || {};
    const records = ids.map(id => result[id]).filter(Boolean);
    $('sequenceResults').innerHTML = records.map(record => {
      const title = record.title || 'Name not provided';
      const accession = record.caption || record.accessionversion || record.uid || '';
      const length = record.slen ? `${Number(record.slen).toLocaleString('en-US')} nucleotides` : 'Length not provided';
      return `<article class="sequence-record"><b>${esc(title)}</b><p>Accession: ${esc(accession)} · ${esc(length)}</p><a class="record-link" href="https://www.ncbi.nlm.nih.gov/nuccore/${encodeURIComponent(accession || record.uid)}" target="_blank" rel="noopener noreferrer">Open NCBI record ↗</a></article>`;
    }).join('');
    setStatus('sequenceStatus', `Records found: ${records.length}. Showing the first records from NCBI Nucleotide.`, 'success');
  } catch (error) {
    setStatus('sequenceStatus', 'Could not retrieve sequences from NCBI. Please try again later. ' + error.message, 'error');
  } finally {
    $('loadSequences').disabled = false;
    $('loadSequences').textContent = 'Find records';
  }
});
$('inspectFasta').addEventListener('click', async () => {
  const file = $('fastaFile').files[0];
  if (!file) {$('fastaStatus').textContent = 'Choose a file first. No file has been uploaded.';return;}
  if (file.size > 20 * 1024 * 1024) {$('fastaStatus').textContent = 'The file exceeds 20 MB. Choose a smaller file for this local check.';return;}
  const content = await file.text();
  const lines = content.split(/\r?\n/);
  const headers = lines.filter(line => line.startsWith('>')).length;
  const seqLines = lines.filter(line => line.trim() && !line.startsWith('>'));
  const invalid = seqLines.join('').replace(/\s/g,'').replace(/[ACGTUNRYKMSWBDHVXacgtunrykmswbdhvx]/g,'');
  $('fastaStatus').textContent = `File: ${file.name}. Size: ${(file.size/1024).toFixed(1)} KB. FASTA headers: ${headers}. ${headers > 0 && seqLines.length > 0 ? 'This appears to be a FASTA file.' : 'Could not confirm FASTA structure.'} ${invalid ? 'Some characters are outside the standard nucleotide alphabet; protein sequences need a different validation mode.' : ''}`;
  $('fastaPreview').textContent = content.slice(0, 1400) + (content.length > 1400 ? '\n… (preview truncated)' : '');
  $('fastaPreview').hidden = false;
});
const tabs = [...document.querySelectorAll('[data-tab]')];
const panes = {paste:$('pastePane'), file:$('filePane'), accession:$('accessionPane')};
tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(item => item.classList.toggle('active', item === tab));
  Object.entries(panes).forEach(([key, pane]) => pane.hidden = key !== tab.dataset.tab);
}));
$('analysisForm').addEventListener('submit', event => {
  event.preventDefault();
  const activeTab = document.querySelector('[data-tab].active').dataset.tab;
  const ready = activeTab === 'paste' ? $('sequenceInput').value.trim().length > 0 :
    activeTab === 'file' ? $('analysisFile').files.length > 0 : $('accessionInput').value.trim().length > 0;
  const status = $('formStatus');
  status.hidden = false;
  status.textContent = ready ? 'Fields are complete. Settings are shown for preview only: no data was sent and no scientific analysis was run.' : 'Add a sequence, choose a file, or enter an accession number. No analysis was run.';
});


/* ProtistCloud expanded record and image explorer.
   These are database retrieval and display features only; no BLAST or other analysis is run. */
(() => {
  const $ = (id) => document.getElementById(id);
  const escHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const NCBI = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
  const status = (id, text) => { const node = $(id); if (node) node.textContent = text; };
  const dbNames = {gene:'Gene', protein:'Protein', nucleotide:'Nucleotide sequence', pubmed:'Publication'};
  const dbLinks = {gene:'gene', protein:'protein', nucleotide:'nuccore', pubmed:'pubmed'};
  async function ncbiSearch(db, term) {
    const searchDb = dbLinks[db];
    const u = `${NCBI}esearch.fcgi?db=${encodeURIComponent(searchDb)}&term=${encodeURIComponent(term)}&retmode=json&retmax=30`;
    const r = await fetch(u);
    if (!r.ok) throw new Error(`NCBI returned HTTP ${r.status}`);
    const j = await r.json();
    return j.esearchresult?.idlist || [];
  }
  async function ncbiSummaries(db, ids) {
    if (!ids.length) return [];
    const u = `${NCBI}esummary.fcgi?db=${encodeURIComponent(dbLinks[db])}&id=${ids.join(',')}&retmode=json`;
    const r = await fetch(u);
    if (!r.ok) throw new Error(`NCBI returned HTTP ${r.status}`);
    const j = await r.json();
    return ids.map(id => j.result?.[id]).filter(Boolean);
  }
  function recordTitle(rec, db) {
    if (db === 'gene') return rec.name || rec.description || `Gene ${rec.uid || ''}`;
    if (db === 'protein' || db === 'nucleotide') return rec.title || rec.caption || `Record ${rec.uid || ''}`;
    return rec.title || 'Untitled publication';
  }
  function recordAcc(rec, db) {
    return rec.accessionversion || rec.caption || rec.uid || rec.id || '';
  }
  function recordUrl(rec, db) {
    const id = encodeURIComponent(recordAcc(rec, db) || rec.uid || '');
    return `https://www.ncbi.nlm.nih.gov/${dbLinks[db]}/${id}/`;
  }
  const recordCache = new Map();
  const resultRoot = $('record-search-results');
  const detailRoot = $('record-detail');
  if ($('record-search-form')) {
    $('record-search-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const term = $('record-query').value.trim();
      const db = $('record-database').value;
      if (!term) return;
      resultRoot.innerHTML = '';
      detailRoot.hidden = true;
      status('record-search-status', 'Searching NCBI for public records…');
      try {
        const ids = await ncbiSearch(db, term);
        const records = await ncbiSummaries(db, ids);
        records.forEach((rec) => recordCache.set(`${db}:${rec.uid}`, {rec, db}));
        if (!records.length) { status('record-search-status', 'No records found. Try a broader term, gene symbol, or accession.'); return; }
        status('record-search-status', `${records.length} records found. Select a record to view details here.`);
        resultRoot.innerHTML = records.map((rec) => {
          const title = recordTitle(rec, db);
          const acc = recordAcc(rec, db);
          const uid = rec.uid || '';
          return `<article class="record-card"><p class="record-meta">${escHtml(dbNames[db])} · ${escHtml(acc)}</p><h3>${escHtml(title)}</h3><p class="record-meta">${escHtml(rec.organism || rec.source || rec.pubdate || '')}</p><div class="record-actions"><button type="button" data-view-record="${escHtml(db)}:${escHtml(uid)}">View inside ProtistCloud</button><a href="${recordUrl(rec, db)}" target="_blank" rel="noopener noreferrer">Original source ↗</a></div></article>`;
        }).join('');
      } catch (err) {
        status('record-search-status', `Could not retrieve records: ${err.message}. Please retry later.`);
      }
    });
    resultRoot.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-view-record]');
      if (!btn) return;
      const key = btn.getAttribute('data-view-record');
      const item = recordCache.get(key);
      if (!item) return;
      const {rec, db} = item;
      detailRoot.hidden = false;
      detailRoot.innerHTML = `<p class="eyebrow">PROTISTCLOUD RECORD VIEW</p><h2>${escHtml(recordTitle(rec, db))}</h2><p class="record-meta">${escHtml(dbNames[db])} · ${escHtml(recordAcc(rec, db))}</p><div id="record-full-detail">Loading record details…</div><div class="record-actions"><a href="${recordUrl(rec, db)}" target="_blank" rel="noopener noreferrer">Open original source ↗</a><button type="button" id="save-record">Save record on this device</button><button type="button" id="download-record">Download record JSON</button></div><p class="record-meta">Saved records are stored only in this browser on this device. This does not create a shared server library.</p>`;
      detailRoot.scrollIntoView({behavior:'smooth', block:'start'});
      $('save-record').addEventListener('click', () => {
        try {
          const keyName = 'protistcloud-saved-records-v1';
          const old = JSON.parse(localStorage.getItem(keyName) || '[]');
          const id = `${db}:${recordAcc(rec, db)}`;
          const next = [ {id, database:db, savedAt:new Date().toISOString(), record:rec}, ...old.filter(x => x.id !== id) ].slice(0,200);
          localStorage.setItem(keyName, JSON.stringify(next));
          $('save-record').textContent = 'Saved on this device ✓';
        } catch { $('save-record').textContent = 'Could not save in this browser'; }
      });
      $('download-record').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({database:db, record:rec, retrievedAt:new Date().toISOString(), source:'NCBI'}, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `protistcloud-${db}-${recordAcc(rec,db)||'record'}.json`; a.click(); URL.revokeObjectURL(url);
      });
      try {
        const params = new URLSearchParams({db:dbLinks[db], id:recordAcc(rec,db) || rec.uid, retmode:'text'});
        if (db === 'nucleotide' || db === 'protein') params.set('rettype', 'fasta');
        const r = await fetch(`${NCBI}efetch.fcgi?${params.toString()}`);
        const body = await r.text();
        const full = $('record-full-detail');
        if (r.ok && body && !body.trim().startsWith('<')) {
          full.innerHTML = `<h3>${db === 'nucleotide' || db === 'protein' ? 'Sequence (FASTA)' : 'Record text'}</h3><pre class="record-sequence">${escHtml(body.slice(0,120000))}</pre><div class="record-actions"><button type="button" id="copy-sequence">Copy content</button><button type="button" id="download-sequence">Download text</button></div>`;
          $('copy-sequence').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(body); $('copy-sequence').textContent = 'Copied ✓'; }
            catch { $('copy-sequence').textContent = 'Clipboard unavailable'; }
          });
          $('download-sequence').addEventListener('click', () => {
            const blob = new Blob([body], {type:'text/plain;charset=utf-8'});
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`${recordAcc(rec,db)||'record'}.txt`; a.click(); URL.revokeObjectURL(url);
          });
        } else {
          full.innerHTML = `<p>Summary details are shown above. The full text format is not available through this view for this record type.</p><pre class="record-sequence">${escHtml(JSON.stringify(rec,null,2))}</pre>`;
        }
      } catch {
        $('record-full-detail').innerHTML = `<p>Could not load full record content right now. You can still save the summary or download its JSON.</p><pre class="record-sequence">${escHtml(JSON.stringify(rec,null,2))}</pre>`;
      }
    });
  }

  if ($('image-search-form')) {
    $('image-search-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const term = $('image-query').value.trim();
      const target = $('image-search-results');
      if (!term) return;
      target.innerHTML = '';
      status('image-search-status', 'Searching Wikimedia Commons…');
      try {
        const api = 'https://commons.wikimedia.org/w/api.php';
        const params = new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrsearch:`filetype:bitmap ${term}`,gsrnamespace:'6',gsrlimit:'18',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'600'});
        const r = await fetch(`${api}?${params.toString()}`);
        if (!r.ok) throw new Error(`Wikimedia returned HTTP ${r.status}`);
        const j = await r.json();
        const pages = Object.values(j.query?.pages || {});
        if (!pages.length) { status('image-search-status', 'No images found. Try the scientific name or a shorter query.'); return; }
        target.innerHTML = pages.map(page => {
          const info = page.imageinfo?.[0] || {};
          const meta = info.extmetadata || {};
          const value = (k) => meta[k]?.value ? String(meta[k].value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim() : '';
          const author = value('Artist') || 'Author not specified';
          const license = value('LicenseShortName') || 'Check file license';
          const description = value('ImageDescription') || page.title;
          const thumb = info.thumburl || info.url || '';
          const fileUrl = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g,'_'))}`;
          return `<article class="image-card"><a href="${escHtml(fileUrl)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${escHtml(thumb)}" alt="${escHtml(page.title)}"></a><h3>${escHtml(page.title.replace(/^File:/,''))}</h3><p>${escHtml(description).slice(0,260)}</p><p class="record-meta">Author: ${escHtml(author)}<br>License: ${escHtml(license)}</p><div class="record-actions"><a href="${escHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">Source and license ↗</a></div></article>`;
        }).join('');
        status('image-search-status', `${pages.length} image results retrieved. Review each source page for attribution and reuse terms.`);
      } catch (err) {
        status('image-search-status', `Could not retrieve images: ${err.message}. Wikimedia may be temporarily unavailable.`);
      }
    });
  }
})();
