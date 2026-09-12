	.file	1 "t18_include.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	rations_left
	.align	2
	.globl	freq_delta
	.align	2
	.globl	flagged

	.text
	.text
	.ent	rations_left
rations_left:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lw	$2,0($4)
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$2,-1
	.set	macro
	.set	reorder

	.end	rations_left
	.text
	.ent	freq_delta
freq_delta:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,-70			# 0xffffffba
	.set	macro
	.set	reorder

	.end	freq_delta
	.text
	.ent	flagged
flagged:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lhu	$2,4($4)
	.set	noreorder
	.set	nomacro
	j	$31
	andi	$2,$2,0x0037
	.set	macro
	.set	reorder

	.end	flagged
