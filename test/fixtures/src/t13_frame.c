/* Large stack frames: offsets beyond the 16-bit immediate range force
   address arithmetic for locals and spills. */
extern int mess_hall(int *tray, int count);

int rations_fill(int seed)
{
    int rations[9000];
    int i;
    for (i = 0; i < 9000; i++)
        rations[i] = seed + i;
    return mess_hall(rations, 9000);
}

int rations_sum(int seed)
{
    int rations[9000];
    int total = 0;
    int i;
    for (i = 0; i < 9000; i++)
        rations[i] = (seed ^ i) & 0xff;
    for (i = 0; i < 9000; i += 3)
        total += rations[i] - rations[i + 1] + rations[i + 2];
    return total;
}

int two_frames(int a, int b)
{
    int first[4100];
    int second[4100];
    first[0] = a;
    second[4099] = b;
    first[4099] = second[4099] + first[0];
    second[0] = first[4099] * 2;
    return first[4099] + second[0] + mess_hall(first, 1) + mess_hall(second, 2);
}
