# External source permission audit

Checked 2026-11-14. This is a connector configuration decision based on the sources
below, not a legal opinion or a grant of rights. No marketplace item pages were
collected. The owner confirmed no authorized feed or written permission exists.

| Source | Evidence | Initial capability |
| --- | --- | --- |
| Craigslist | [Terms](https://www.craigslist.org/about/terms.of.use/en), USE and LICENSE restrict collection, integration and content redistribution absent a separate agreement. | User-entered item URL and original notes only. No page fetching. |
| Freecycle | [Terms](https://www.freecycle.org/pages/TOS), sections 4 and 6 restrict automated downloads and content reproduction/redistribution. | User-entered post URL and original notes only. No page fetching. |
| Facebook Marketplace | [Automated data collection terms](https://www.facebook.com/legal/automated_data_collection_terms) redirected to login/blocked access in this environment. No authorized Marketplace collection API or republication permission was verified. | Marketplace item URL intake only. Groups, login pages, redirect links and automated collection are unavailable. |
| Buy Nothing | [Terms](https://buynothingproject.org/terms) restrict reuse beyond permitted personal use. No authorized feed or reusable public item-link format was verified. | Connector unavailable. No private group ingestion. |

Submitting a URL does not grant source access, redistribution rights, verified
availability or publication approval. Only the submitter's original notes and
structured self-reported facts enter the private review queue. Do not paste third
party descriptions or images. Reviewers must establish the necessary source and
content permissions before any future publication. Until those gates exist,
foundation candidates cannot be published or recommended as available listings.

No polling job is enabled for these marketplaces. Future authorized feeds require
documented collection AND reuse rights, explicit endpoint/host configuration,
source rate limits, a verification method and a reviewed connector implementation.
The initial configurable region is Berkeley, Oakland, San Francisco and nearby
Bay Area cities; no coordinates or geographic distances are inferred.
