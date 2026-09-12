# 1 "t07_struct.c"
struct Foo { int value; short s; char c; unsigned char uc; int arr[3]; struct Foo *next; };
struct Small { short a; short b; };
int get_field(struct Foo *x) { return x->value; }
int get_c(struct Foo *x) { return x->c; }
int get_uc(struct Foo *x) { return x->uc; }
int get_s(struct Foo *x) { return x->s; }
int get_arr2(struct Foo *x) { return x->arr[2]; }
int get_next_value(struct Foo *x) { return x->next->next->value; }
void set_all(struct Foo *x, int v) { x->value = v; x->s = v; x->c = v; x->arr[0] = v; }
void copy_foo(struct Foo *d, struct Foo *s) { *d = *s; }
struct Small make_small(short a, short b) { struct Small r; r.a = a; r.b = b; return r; }
int sum_small(struct Small s) { return s.a + s.b; }
int walk(struct Foo *x) { int n = 0; while (x) { n += x->value; x = x->next; } return n; }
