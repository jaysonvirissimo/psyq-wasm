int char_promote(char c) { return c; }
int schar_promote(signed char c) { return c; }
int uchar_promote(unsigned char c) { return c; }
int short_promote(short s) { return s; }
int ushort_promote(unsigned short s) { return s; }
int char_lt(char a, char b) { return a < b; }
int char_is_neg(char c) { return c < 0; }
unsigned char narrow(int x) { return x; }
short narrow_s(int x) { return x; }
int char_arith(char a, char b) { return a + b; }
unsigned mix(unsigned a, int b) { return a + b; }
int cmp_mixed(unsigned a, int b) { return a < b; }
long long_id(long x) { return x; }
int str_len(const char *s) { const char *p = s; while (*p) p++; return p - s; }
