const { DEFAULT_LIMIT, parsePagination, sliceArgs } = require('../pagination');

describe('pagination', () => {
  test('query kosong → default limit 10 dan offset 0', () => {
    expect(parsePagination(undefined)).toEqual({ limit: DEFAULT_LIMIT, offset: 0 });
    expect(parsePagination({})).toEqual({ limit: 10, offset: 0 });
  });

  test('limit/offset string dikonversi ke angka', () => {
    expect(parsePagination({ limit: '5', offset: '10' })).toEqual({ limit: 5, offset: 10 });
  });

  test('nilai tidak valid → default', () => {
    expect(parsePagination({ limit: '0' })).toEqual({ limit: 10, offset: 0 });
    expect(parsePagination({ limit: '200' })).toEqual({ limit: 10, offset: 0 });
    expect(parsePagination({ offset: '-1' })).toEqual({ limit: 10, offset: 0 });
    expect(parsePagination({ limit: 'abc' })).toEqual({ limit: 10, offset: 0 });
  });

  test('sliceArgs memetakan take/skip dengan default 10', () => {
    expect(sliceArgs({})).toEqual({ take: 10 });
    expect(sliceArgs({ limit: 5 })).toEqual({ take: 5 });
    expect(sliceArgs({ offset: 10 })).toEqual({ take: 10, skip: 10 });
    expect(sliceArgs({ limit: 5, offset: 10 })).toEqual({ take: 5, skip: 10 });
  });
});
