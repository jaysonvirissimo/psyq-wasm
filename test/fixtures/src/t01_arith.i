# 1 "t01_arith.c"
int add_one(int x) { return x + 1; }
int add3(int a, int b, int c) { return a + b - c; }
int neg_and(int a, int b) { return (-a) & b | (a ^ b); }
int addk(int a) { return a + 100000; }
unsigned uaddk(unsigned a) { return a - 0x12345678u; }
