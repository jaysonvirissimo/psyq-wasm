/* A valid function followed by a preprocessor error: cccp must report it and
   exit non-zero, and the compiler must not run. */
int otacon(int x) { return x + 1; }
#ifndef SHADOW_MOSES_CODEC
#error shadow moses codec unavailable
#endif
int hound(void) { return 0; }
