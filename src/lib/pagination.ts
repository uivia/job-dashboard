export const PAGE_SIZE = 10;

export function getPagination(rawPage: string | string[] | undefined, totalItems: number) {
  const requestedPage = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;

  return { page, pageSize: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, totalPages };
}
