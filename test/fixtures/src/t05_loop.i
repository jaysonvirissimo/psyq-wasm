# 1 "t05_loop.c"
int sum(int *p, int n)
{
    int result = 0;
    while (n--)
        result += *p++;
    return result;
}
int sum_for(int *p, int n)
{
    int i, s = 0;
    for (i = 0; i < n; i++)
        s += p[i];
    return s;
}
int count_down(int n)
{
    int c = 0;
    do { c += n; } while (--n > 0);
    return c;
}
void fill(short *p, int n, short v)
{
    while (n-- > 0) *p++ = v;
}
