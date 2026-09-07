	.file	1 "t09_sign.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	char_promote
	.ent	char_promote
char_promote:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	andi	$2,$4,0x00ff
	.set	macro
	.set	reorder

	.end	char_promote
	.align	2
	.globl	schar_promote
	.ent	schar_promote
schar_promote:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$2,$4,24
	.set	noreorder
	.set	nomacro
	j	$31
	sra	$2,$2,24
	.set	macro
	.set	reorder

	.end	schar_promote
	.align	2
	.globl	uchar_promote
	.ent	uchar_promote
uchar_promote:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	andi	$2,$4,0x00ff
	.set	macro
	.set	reorder

	.end	uchar_promote
	.align	2
	.globl	short_promote
	.ent	short_promote
short_promote:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$2,$4,16
	.set	noreorder
	.set	nomacro
	j	$31
	sra	$2,$2,16
	.set	macro
	.set	reorder

	.end	short_promote
	.align	2
	.globl	ushort_promote
	.ent	ushort_promote
ushort_promote:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	andi	$2,$4,0xffff
	.set	macro
	.set	reorder

	.end	ushort_promote
	.align	2
	.globl	char_lt
	.ent	char_lt
char_lt:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	andi	$4,$4,0x00ff
	andi	$2,$5,0x00ff
	.set	noreorder
	.set	nomacro
	j	$31
	sltu	$2,$4,$2
	.set	macro
	.set	reorder

	.end	char_lt
	.align	2
	.globl	char_is_neg
	.ent	char_is_neg
char_is_neg:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$0
	.set	macro
	.set	reorder

	.end	char_is_neg
	.align	2
	.globl	narrow
	.ent	narrow
narrow:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	andi	$2,$4,0x00ff
	.set	macro
	.set	reorder

	.end	narrow
	.align	2
	.globl	narrow_s
	.ent	narrow_s
narrow_s:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$2,$4,16
	.set	noreorder
	.set	nomacro
	j	$31
	sra	$2,$2,16
	.set	macro
	.set	reorder

	.end	narrow_s
	.align	2
	.globl	char_arith
	.ent	char_arith
char_arith:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	andi	$4,$4,0x00ff
	andi	$2,$5,0x00ff
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$4,$2
	.set	macro
	.set	reorder

	.end	char_arith
	.align	2
	.globl	mix
	.ent	mix
mix:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$4,$5
	.set	macro
	.set	reorder

	.end	mix
	.align	2
	.globl	cmp_mixed
	.ent	cmp_mixed
cmp_mixed:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sltu	$2,$4,$5
	.set	macro
	.set	reorder

	.end	cmp_mixed
	.align	2
	.globl	long_id
	.ent	long_id
long_id:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$4
	.set	macro
	.set	reorder

	.end	long_id
	.align	2
	.globl	str_len
	.ent	str_len
str_len:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lbu	$2,0($4)
	#nop
	.set	noreorder
	.set	nomacro
	beq	$2,$0,$L16
	move	$3,$4
	.set	macro
	.set	reorder

	addu	$3,$3,1
$L19:
	lbu	$2,0($3)
	#nop
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L19
	addu	$3,$3,1
	.set	macro
	.set	reorder

	addu	$3,$3,-1
$L16:
	.set	noreorder
	.set	nomacro
	j	$31
	subu	$2,$3,$4
	.set	macro
	.set	reorder

	.end	str_len

	.text
