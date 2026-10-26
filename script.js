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
