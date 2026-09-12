# 1 "t06_ptr.c"
int ld_i(int *p) { return *p; }
short ld_s(short *p) { return *p; }
unsigned short ld_us(unsigned short *p) { return *p; }
char ld_c(char *p) { return *p; }
signed char ld_sc(signed char *p) { return *p; }
unsigned char ld_uc(unsigned char *p) { return *p; }
void st_i(int *p, int v) { *p = v; }
void st_s(short *p, short v) { *p = v; }
void st_c(char *p, char v) { *p = v; }
int ld_off(int *p) { return p[3] + p[-2]; }
void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }
int arr_idx(int *a, int i) { return a[i]; }
int arr2(int a[4][4], int i, int j) { return a[i][j]; }
static int table[8] = { 1, 2, 3, 4, 5, 6, 7, 8 };
int tbl(int i) { return table[i & 7]; }
