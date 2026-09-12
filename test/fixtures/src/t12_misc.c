struct V { int x, y, z; };
extern int ext2(int, int);
int dot(struct V *a, struct V *b) { return a->x * b->x + a->y * b->y + a->z * b->z; }
int fixed_mul(int a, int b) { return (a * b) >> 12; }
int abs_(int x) { return x < 0 ? -x : x; }
int clamp(int x, int lo, int hi) { if (x < lo) x = lo; if (x > hi) x = hi; return x; }
unsigned pack(unsigned char r, unsigned char g, unsigned char b) { return r | (g << 8) | (b << 16); }
int bits(unsigned x) { int n = 0; while (x) { n += x & 1; x >>= 1; } return n; }
int nested(int a, int b) { int i, j, s = 0; for (i = 0; i < a; i++) for (j = 0; j < b; j++) s += ext2(i, j); return s; }
void memcpy_like(char *d, const char *s, int n) { while (n-- > 0) *d++ = *s++; }
int ternary_chain(int x) { return x == 1 ? 10 : x == 2 ? 20 : x == 3 ? 30 : 0; }
