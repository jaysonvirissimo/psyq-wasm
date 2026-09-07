/* Preprocessor features: object-like and function-like macros, stringification,
   token pasting, conditionals on the PsyQ predefines, __LINE__ and __FILE__,
   and backslash continuation. */
#define CODEC_FREQ 14085
#define SQUARE(x) ((x) * (x))
#define STR(x) #x
#define XSTR(x) STR(x)
#define CAT(a, b) a##b
#define MAX(a, b) \
    ((a) > (b) ? (a) : (b))

#if defined(_PSYQ) && defined(__mips__)
#define TARGET_ID 1
#elif defined(__linux__)
#define TARGET_ID 2
#else
#define TARGET_ID 0
#endif

#ifdef __OPTIMIZE__
#define FAST 1
#else
#define FAST 0
#endif

#ifndef __CHAR_UNSIGNED__
#error PsyQ char is unsigned
#endif

int CAT(codec_, freq)(void) { return CODEC_FREQ; }
int square_plus(int x) { return SQUARE(x) + MAX(x, TARGET_ID) + FAST; }
const char *codec_name(void) { return XSTR(CODEC_FREQ) " " STR(campbell); }
const char *where(void) { return __FILE__; }
int line(void) { return __LINE__; }
#if __GNUC__ == 2
int gnuc(void) { return __GNUC__; }
#endif
