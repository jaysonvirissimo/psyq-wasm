	.file	1 "t03_muldiv.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	mul
	.ent	mul
mul:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	mult	$4,$5
	mflo	$2
	#nop
	j	$31
	.end	mul
	.align	2
	.globl	mulk
	.ent	mulk
mulk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$2,$4,1
	addu	$2,$2,$4
	.set	noreorder
	.set	nomacro
	j	$31
	sll	$2,$2,2
	.set	macro
	.set	reorder

	.end	mulk
	.align	2
	.globl	mulk2
	.ent	mulk2
mulk2:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$2,$4,5
	subu	$2,$2,$4
	sll	$2,$2,2
	addu	$2,$2,$4
	.set	noreorder
	.set	nomacro
	j	$31
	sll	$2,$2,3
	.set	macro
	.set	reorder

	.end	mulk2
	.align	2
	.globl	div_
	.ent	div_
div_:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	div	$2,$4,$5
	j	$31
	.end	div_
	.align	2
	.globl	udiv_
	.ent	udiv_
udiv_:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	divu	$2,$4,$5
	j	$31
	.end	udiv_
	.align	2
	.globl	mod_
	.ent	mod_
mod_:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	rem	$2,$4,$5
	j	$31
	.end	mod_
	.align	2
	.globl	divk
	.ent	divk
divk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li	$2,-1840709632			# 0x92490000
	ori	$2,$2,0x2493
	mult	$4,$2
	mfhi	$3
	#nop
	#nop
	addu	$2,$3,$4
	sra	$2,$2,2
	sra	$4,$4,31
	.set	noreorder
	.set	nomacro
	j	$31
	subu	$2,$2,$4
	.set	macro
	.set	reorder

	.end	divk
	.align	2
	.globl	divk2
	.ent	divk2
divk2:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	bgez	$4,$L9
	addu	$4,$4,4095
$L9:
	.set	noreorder
	.set	nomacro
	j	$31
	sra	$2,$4,12
	.set	macro
	.set	reorder

	.end	divk2
	.align	2
	.globl	udivk
	.ent	udivk
udivk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li	$2,-858993459			# 0xcccccccd
	multu	$4,$2
	mfhi	$3
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	srl	$2,$3,3
	.set	macro
	.set	reorder

	.end	udivk
	.align	2
	.globl	modk
	.ent	modk
modk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	bgez	$4,$L12
	move	$2,$4
	.set	macro
	.set	reorder

	addu	$2,$4,15
$L12:
	sra	$2,$2,4
	sll	$2,$2,4
	.set	noreorder
	.set	nomacro
	j	$31
	subu	$2,$4,$2
	.set	macro
	.set	reorder

	.end	modk
	.align	2
	.globl	umodk
	.ent	umodk
umodk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li	$2,274857984			# 0x10620000
	ori	$2,$2,0x4dd3
	multu	$4,$2
	mfhi	$5
	#nop
	#nop
	srl	$3,$5,6
	sll	$2,$3,5
	subu	$2,$2,$3
	sll	$2,$2,2
	addu	$2,$2,$3
	sll	$2,$2,3
	.set	noreorder
	.set	nomacro
	j	$31
	subu	$2,$4,$2
	.set	macro
	.set	reorder

	.end	umodk

	.text
