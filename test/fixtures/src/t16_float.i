# 1 "t16_float.c"
 


float freq_a = 140.85f;
float freq_b = 141.12f;
double freq_c = 140.15;

float pick(int which)
{
    if (which == 0) return freq_a;
    if (which == 1) return freq_b;
    return (float)freq_c;
}

int to_int(float f) { return (int)f; }
unsigned to_uint(float f) { return (unsigned)f; }
short to_short(double d) { return (short)d; }
float from_int(int i) { return (float)i; }
double from_uint(unsigned u) { return (double)u; }

int close_enough(float a, float b)
{
    float d = a - b;
    if (d < 0.0f) d = -d;
    return d < 0.01f;
}

double average(float *values, int n)
{
    double sum = 0.0;
    int i;
    for (i = 0; i < n; i++)
        sum += values[i];
    return n > 0 ? sum / n : 0.0;
}

float scale(float v)
{
    return v * 2.5f + 0.5f;
}

int compare_doubles(double a, double b)
{
    if (a < b) return -1;
    if (a > b) return 1;
    return a == b ? 0 : 2;
}
