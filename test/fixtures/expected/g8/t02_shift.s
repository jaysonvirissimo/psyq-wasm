	.file	1 "t02_shift.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	shl
	.align	2
	.globl	shr
	.align	2
	.globl	ushr
	.align	2
	.globl	shlk
	.align	2
	.globl	shrk
	.align	2
	.globl	ushrk
	.align	2
	.globl	rot5

	.text
	.text
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
	.text
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
	.text
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
	.text
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
	.text
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
	.text
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
	.text
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
