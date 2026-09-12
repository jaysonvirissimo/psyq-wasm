/* Patterns typical of code that prepares data for the geometry transformation
   engine: packed short vectors, 3x3 matrices with 12-bit fixed-point entries,
   and long accumulators. Original code, not from any SDK. */
struct SVec {
    short vx, vy, vz, pad;
};

struct Mat33 {
    short m[3][3];
    short pad;
    long t[3];
};

struct Cardboard {
    struct SVec corner[8];
    struct Mat33 pose;
    int flags;
};

long dot_fixed(struct SVec *a, struct SVec *b)
{
    return ((long)a->vx * b->vx + (long)a->vy * b->vy + (long)a->vz * b->vz) >> 12;
}

void apply_rot(struct Mat33 *m, struct SVec *in, struct SVec *out)
{
    long x = (long)m->m[0][0] * in->vx + (long)m->m[0][1] * in->vy + (long)m->m[0][2] * in->vz;
    long y = (long)m->m[1][0] * in->vx + (long)m->m[1][1] * in->vy + (long)m->m[1][2] * in->vz;
    long z = (long)m->m[2][0] * in->vx + (long)m->m[2][1] * in->vy + (long)m->m[2][2] * in->vz;
    out->vx = (short)((x >> 12) + m->t[0]);
    out->vy = (short)((y >> 12) + m->t[1]);
    out->vz = (short)((z >> 12) + m->t[2]);
    out->pad = 0;
}

void identity(struct Mat33 *m)
{
    int i, j;
    for (i = 0; i < 3; i++) {
        for (j = 0; j < 3; j++)
            m->m[i][j] = (short)(i == j ? 4096 : 0);
        m->t[i] = 0;
    }
    m->pad = 0;
}

int transform_box(struct Cardboard *box, struct SVec *out)
{
    int i;
    int clipped = 0;
    for (i = 0; i < 8; i++) {
        apply_rot(&box->pose, &box->corner[i], &out[i]);
        if (out[i].vz < 0)
            clipped |= 1 << i;
    }
    box->flags = clipped;
    return clipped;
}

void scale_matrix(struct Mat33 *m, short factor)
{
    int i, j;
    for (i = 0; i < 3; i++)
        for (j = 0; j < 3; j++)
            m->m[i][j] = (short)(((long)m->m[i][j] * factor) >> 12);
}
