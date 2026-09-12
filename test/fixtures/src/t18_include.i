# 1 "t18_include.c"
 

# 1 "include/codec.h" 1


 
# 1 "include/codec/freq.h" 1





# 4 "include/codec.h" 2


struct Ration { int count; short flags; };

# 3 "t18_include.c" 2

# 1 "t18_include.h" 1
 

# 4 "t18_include.c" 2


int rations_left(struct Ration *r) { return r->count - 14085  % 7; }
int freq_delta(void) { return 14012  - 14085  + 3 ; }
int flagged(struct Ration *r) { return r->flags & (14115  >> 8); }
