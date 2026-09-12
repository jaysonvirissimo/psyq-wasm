/* Halfword loads and stores, signed and unsigned, with compares. */
short codec_freq[3] = { 14085, 14112, 14015 };
unsigned short codec_mask[4];

short load_signed(short *p, int i) { return p[i]; }
unsigned short load_unsigned(unsigned short *p, int i) { return p[i]; }
void store_half(short *p, int i, short v) { p[i] = v; }
void store_uhalf(unsigned short *p, int i, unsigned short v) { p[i] = v; }

int widen_signed(short *p) { return p[0] + p[1] + p[2]; }
unsigned widen_unsigned(unsigned short *p) { return p[0] + p[1] + p[2]; }

int compare_signed(short a, short b)
{
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

int compare_unsigned(unsigned short a, unsigned short b)
{
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

short tune(int step)
{
    short freq = codec_freq[step % 3];
    codec_mask[step & 3] = (unsigned short)(freq + step);
    return (short)(freq - codec_mask[(step + 1) & 3]);
}

int negative_half(short *p)
{
    p[-1] = -1;
    p[-2] = p[-1] - 1;
    return p[-2];
}
