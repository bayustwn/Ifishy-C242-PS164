const { parsePagination, sliceArgs } = require('../pagination');

describe('pagination', () => {
  test('query kosong → objek kosong', () => {
    expect(parsePagination(undefined)).toEqual({});
    expect(parsePagination({})).toEqual({});
  });

  test('limit/offset string dikonversi ke angka', () => {
    expect(parsePagination({ limit: '5', offset: '10' })).toEqual({ limit: 5, offset: 10 });
  });

  test('nilai tidak valid → objek kosong', () => {
    expect(parsePagination({ limit: '0' })).toEqual({});
    expect(parsePagination({ limit: '200' })).toEqual({});
    expect(parsePagination({ offset: '-1' })).toEqual({});
    expect(parsePagination({ limit: 'abc' })).toEqual({});
  });

  test('sliceArgs memetakan take/skip', () => {
    expect(sliceArgs({})).toEqual({});
    expect(sliceArgs({ limit: 5 })).toEqual({ take: 5 });
    expect(sliceArgs({ offset: 10 })).toEqual({ skip: 10 });
    expect(sliceArgs({ limit: 5, offset: 10 })).toEqual({ take: 5, skip: 10 });
  });
});
