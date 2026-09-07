	.file	1 "t02_shift.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	shl
	.ent	shl
shl:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sll	$2,$4,$5
	.set	macro
	.set	reorder

	.end	shl
	.align	2
	.globl	shr
	.ent	shr
shr:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sra	$2,$4,$5
	.set	macro
	.set	reorder

	.end	shr
	.align	2
	.globl	ushr
	.ent	ushr
ushr:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	srl	$2,$4,$5
	.set	macro
	.set	reorder

	.end	ushr
	.align	2
	.globl	shlk
	.ent	shlk
shlk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sll	$2,$4,5
	.set	macro
	.set	reorder

	.end	shlk
	.align	2
	.globl	shrk
	.ent	shrk
shrk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sra	$2,$4,7
	.set	macro
	.set	reorder

	.end	shrk
	.align	2
	.globl	ushrk
	.ent	ushrk
ushrk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	srl	$2,$4,9
	.set	macro
	.set	reorder

	.end	ushrk
	.align	2
	.globl	rot5
	.ent	rot5
rot5:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	andi	$2,$4,0xffff
	srl	$2,$2,11
	sll	$4,$4,5
	or	$2,$2,$4
	.set	noreorder
	.set	nomacro
	j	$31
	andi	$2,$2,0xffff
	.set	macro
	.set	reorder

	.end	rot5

	.text
