extern int callee(int a, int b);
extern int callee6(int a, int b, int c, int d, int e, int f);
extern void take_ptr(int *p);
int call1(int x) { return callee(x, x + 1) * 2; }
int call_many(int a, int b) { return callee6(a, b, a + b, a - b, a * b, 42); }
int call_local(void) { int local = 5; take_ptr(&local); return local; }
int chain(int a) { return callee(callee(a, 1), callee(a, 2)); }
static int helper(int x) { return x * 3 + 1; }
int use_helper(int a, int b) { return helper(a) + helper(b); }
int recursive(int n) { if (n <= 1) return 1; return n * recursive(n - 1); }
