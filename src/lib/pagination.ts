export const PAGE_SIZE = 10;
export const PAGE_SIZES = [10, 25, 50, 100];

export function getPagination(rawPage: string | string[] | undefined, totalItems: number, rawPageSize?: string | string[]) {
  const requestedPageSize = Number(Array.isArray(rawPageSize) ? rawPageSize[0] : rawPageSize);
  const pageSize = PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : PAGE_SIZE;
  const requestedPage = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;

  return { page, pageSize, skip: (page - 1) * pageSize, totalPages };
}
