/* A valid function followed by a syntax error: the compiler must report the
   error, exit non-zero, and produce no assembly. */
int otacon(int x)
{
    return x + 1;
}

int hound( { }
