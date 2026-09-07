/* Angle includes search only the -I directories; quote includes start in the
   including file's directory. */
#include <codec.h>
#include "t18_include.h"

int rations_left(struct Ration *r) { return r->count - CODEC_CAMPBELL % 7; }
int freq_delta(void) { return CODEC_MEILING - CODEC_CAMPBELL + LOCAL_OFFSET; }
int flagged(struct Ration *r) { return r->flags & (CODEC_NASTASHA >> 8); }
