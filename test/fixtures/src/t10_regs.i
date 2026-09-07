# 1 "t10_regs.c"
int pressure(int a, int b, int c, int d, int e, int f, int g, int h)
{
    int t1 = a * b, t2 = c * d, t3 = e * f, t4 = g * h;
    int t5 = t1 + t2, t6 = t3 + t4, t7 = t1 - t3, t8 = t2 - t4;
    int t9 = t5 * t6, t10 = t7 * t8;
    return t9 + t10 + (t1 ^ t2 ^ t3 ^ t4) + (t5 | t6) + (t7 & t8);
}
extern int ext(int);
int spill(int a, int b, int c, int d)
{
    int x = ext(a), y = ext(b), z = ext(c), w = ext(d);
    return ext(x + y) + ext(z + w) + x * z + y * w;
}
int bigframe(int n)
{
    int buf[64];
    int i;
    for (i = 0; i < 64; i++) buf[i] = i * n;
    return buf[n & 63] + buf[(n + 1) & 63];
}
