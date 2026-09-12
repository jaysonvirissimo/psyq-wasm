# 1 "t04_branch.c"
int max_(int a, int b) { if (a > b) return a; return b; }
unsigned umax(unsigned a, unsigned b) { return a > b ? a : b; }
int sign(int x) { if (x < 0) return -1; else if (x > 0) return 1; return 0; }
int classify(int x)
{
    switch (x) {
    case 0: return 10;
    case 1: return 20;
    case 2: return 30;
    case 3: return 45;
    case 4: return 50;
    case 5: return 65;
    case 6: return 70;
    default: return -1;
    }
}
int cmp_s(int a, int b) { return a < b; }
int cmp_u(unsigned a, unsigned b) { return a < b; }
int cmp_sk(int a) { return a < 100; }
int cmp_uk(unsigned a) { return a < 100; }
int cmp_ge(int a, int b) { return a >= b; }
int cmp_uge(unsigned a, unsigned b) { return a >= b; }
