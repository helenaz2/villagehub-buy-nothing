export type CategoryProposalInput = { name: string; reason: string; proposedBy: string };
export type CategoryProposalResult = { status: 'approved' | 'pending' | 'rejected'; name: string; message: string; source: 'demo' | 'server' };
export function normalizeCategory(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}
export function validateCategoryProposal(input: CategoryProposalInput): string | undefined {
  const name = normalizeCategory(input.name);
  if (name.length < 2 || name.length > 40) return 'Use a category name between 2 and 40 characters.';
  if (!/^[\p{L}\p{N}][\p{L}\p{N} &'-]*$/u.test(name)) return 'Use letters, numbers, spaces, or simple punctuation.';
  if (['for you', 'all'].includes(name.toLowerCase())) return 'Please choose a different category name.';
  if (input.reason.trim().length < 5 || input.reason.trim().length > 500) return 'Explain the category in 5 to 500 characters.';
}
// Integration boundary: replace this demo adapter with an authenticated backend
// request. The server must own AI review, deduplication, the approved catalog,
// and broadcasting catalog changes. Never put AI credentials in the mobile app.
export async function reviewCategoryProposal(input: CategoryProposalInput): Promise<CategoryProposalResult> {
  const error = validateCategoryProposal(input);
  if (error) throw new Error(error);
  return { status: 'approved', name: normalizeCategory(input.name), message: 'Auto-approved for this demo session. AI review and sharing across users are not connected yet.', source: 'demo' };
}
