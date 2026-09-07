	.file	1 "t01_arith.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	add_one
	.ent	add_one
add_one:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$4,1
	.set	macro
	.set	reorder

	.end	add_one
	.align	2
	.globl	add3
	.ent	add3
add3:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	addu	$2,$4,$5
	.set	noreorder
	.set	nomacro
	j	$31
	subu	$2,$2,$6
	.set	macro
	.set	reorder

	.end	add3
	.align	2
	.globl	neg_and
	.ent	neg_and
neg_and:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	subu	$2,$0,$4
	and	$2,$2,$5
	xor	$4,$4,$5
	.set	noreorder
	.set	nomacro
	j	$31
	or	$2,$2,$4
	.set	macro
	.set	reorder

	.end	neg_and
	.align	2
	.globl	addk
	.ent	addk
addk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li	$2,65536			# 0x00010000
	ori	$2,$2,0x86a0
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$4,$2
	.set	macro
	.set	reorder

	.end	addk
	.align	2
	.globl	uaddk
	.ent	uaddk
uaddk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li	$2,-305463296			# 0xedcb0000
	ori	$2,$2,0xa988
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$4,$2
	.set	macro
	.set	reorder

	.end	uaddk

	.text
