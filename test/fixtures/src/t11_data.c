int g_int = 7;
static int s_int = 9;
char g_arr[100];
short g_small[3] = { 1, 2, 3 };
const char *g_str = "hello world";
double g_dbl = 3.14159;
float g_flt = 2.5f;
int use_globals(int i) { return g_int + s_int + g_arr[i] + g_small[i & 1]; }
const char *get_str(void) { return "literal"; }
double get_dbl(void) { return g_dbl * 2.0; }
float get_flt(float x) { return x + g_flt; }
int float_cmp(float a, float b) { return a < b; }
int to_int(double d) { return (int)d; }
double from_int(int i) { return i; }
double consts(void) { return 1.0e10 + 1.0e-5; }
