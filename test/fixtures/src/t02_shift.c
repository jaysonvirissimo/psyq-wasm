int shl(int a, int n) { return a << n; }
int shr(int a, int n) { return a >> n; }
unsigned ushr(unsigned a, int n) { return a >> n; }
int shlk(int a) { return a << 5; }
int shrk(int a) { return a >> 7; }
unsigned ushrk(unsigned a) { return a >> 9; }
unsigned rot5(unsigned short id) { return (unsigned short)((id << 5) | (id >> 11)); }
