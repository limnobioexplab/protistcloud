# ProtistCloud v0.3 — English interface

ProtistCloud is an early, static prototype for browsing protist taxonomy and public nucleotide records.

## Included
- English-language responsive interface.
- Organism search using NCBI Taxonomy (NCBI E-utilities).
- Organism record cards with links to original NCBI records.
- Search for nucleotide records associated with a selected taxon.
- Local FASTA file preview and basic format check in the browser (maximum 20 MB).
- Simple and professional interface modes.
- An analysis-settings form that **does not run scientific analyses**.

## Important limitations
- This is a prototype, not a validated scientific analysis platform.
- The site sends organism search queries to NCBI when you use the search feature.
- FASTA preview is processed locally in the browser; the file is not uploaded.
- The analysis form only checks whether input has been provided. BLAST and other scientific computations are not implemented.
- Similarity results, when added in the future, must not be treated as proof of organism identity or biological function.
- No user accounts or backend job queue are included.

## Publish with GitHub Pages
1. Create a GitHub account and verify your email.
2. Create a **public** repository, for example `protistcloud`.
3. Upload `index.html`, `style.css`, and `script.js` from this folder to the repository root. You can also upload this README.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**, choose `main` and `/(root)`, then save.
6. Wait for deployment and open the URL shown in Pages settings.

GitHub Pages can publish static HTML, CSS, and JavaScript files from a repository. See the official guide: https://docs.github.com/en/pages/quickstart

## Files
- `index.html` — page structure and interface text
- `style.css` — visual design and responsive layout
- `script.js` — NCBI search, local FASTA preview, and form behavior

No passwords, access tokens, or private data should be added to this public repository.
