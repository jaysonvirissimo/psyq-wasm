	.file	1 "t16_float.c"
gcc2_compiled.:
__gnu_compiled_c:
	.globl	freq_a
	.sdata
	.align	2
freq_a:
	.word	0x430cd99a		# 140.850006104 (float)
	.globl	freq_b
	.align	2
freq_b:
	.word	0x430d1eb8		# 141.119995117 (float)
	.globl	freq_c
	.align	3
freq_c:
	.word	0xcccccccd		# 140.15000000000000568
	.word	0x406184cc
	.text
	.align	2
	.globl	pick
	.align	2
	.globl	to_int
	.align	2
	.globl	to_uint
	.align	2
	.globl	to_short
	.align	2
	.globl	from_int
	.align	2
	.globl	from_uint
	.align	2
	.globl	close_enough
	.align	2
	.globl	average
	.align	2
	.globl	scale
	.align	2
	.globl	compare_doubles

	.text
	.text
	.ent	pick
pick:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	.set	noreorder
	.set	nomacro
	bne	$4,$0,$L2
	sw	$31,16($sp)
	.set	macro
	.set	reorder

	lw	$2,freq_a
	j	$L4
$L2:
	li	$2,1			# 0x00000001
	beq	$4,$2,$L3
	lw	$4,freq_c
	lw	$5,freq_c+4
	jal	__truncdfsf2
	j	$L4
$L3:
	lw	$2,freq_b
$L4:
	lw	$31,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	pick
	.text
	.ent	to_int
to_int:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$31,16($sp)
	jal	__fixsfsi
	lw	$31,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	to_int
	.text
	.ent	to_uint
to_uint:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$31,16($sp)
	jal	__fixunssfsi
	lw	$31,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	to_uint
	.text
	.ent	to_short
to_short:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$31,16($sp)
	jal	__fixdfsi
	sll	$2,$2,16
	lw	$31,16($sp)
	sra	$2,$2,16
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	to_short
	.text
	.ent	from_int
from_int:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$31,16($sp)
	jal	__floatsisf
	lw	$31,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	from_int
	.text
	.ent	from_uint
from_uint:
	.frame	$sp,24,$31		# vars= 0, regs= 2/0, args= 16, extra= 0
	.mask	0x80010000,-4
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$16,16($sp)
	sw	$31,20($sp)
	.set	noreorder
	.set	nomacro
	jal	__floatsidf
	move	$16,$4
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	bgez	$16,$L10
	move	$4,$2
	.set	macro
	.set	reorder

	li.d	$6,4.29496729600000000000e9
	.set	noreorder
	.set	nomacro
	jal	__adddf3
	move	$5,$3
	.set	macro
	.set	reorder

$L10:
	lw	$31,20($sp)
	lw	$16,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	from_uint
	.text
	.ent	close_enough
close_enough:
	.frame	$sp,24,$31		# vars= 0, regs= 2/0, args= 16, extra= 0
	.mask	0x80010000,-4
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$31,20($sp)
	.set	noreorder
	.set	nomacro
	jal	__subsf3
	sw	$16,16($sp)
	.set	macro
	.set	reorder

	move	$16,$2
	move	$4,$16
	.set	noreorder
	.set	nomacro
	jal	__ltsf2
	move	$5,$0
	.set	macro
	.set	reorder

	bgez	$2,$L12
	.set	noreorder
	.set	nomacro
	jal	__negsf2
	move	$4,$16
	.set	macro
	.set	reorder

	move	$16,$2
$L12:
	li.s	$5,9.99999977648258209229e-3
	.set	noreorder
	.set	nomacro
	jal	__ltsf2
	move	$4,$16
	.set	macro
	.set	reorder

	lw	$31,20($sp)
	lw	$16,16($sp)
	srl	$2,$2,31
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	close_enough
	.text
	.ent	average
average:
	.frame	$sp,40,$31		# vars= 0, regs= 6/0, args= 16, extra= 0
	.mask	0x801f0000,-4
	.fmask	0x00000000,0
	subu	$sp,$sp,40
	sw	$20,32($sp)
	move	$20,$5
	sw	$19,28($sp)
	sw	$18,24($sp)
	move	$18,$0
	move	$19,$0
	sw	$16,16($sp)
	move	$16,$0
	sw	$31,36($sp)
	.set	noreorder
	.set	nomacro
	blez	$20,$L16
	sw	$17,20($sp)
	.set	macro
	.set	reorder

	move	$17,$4
$L18:
	lw	$4,0($17)
	addu	$17,$17,4
	.set	noreorder
	.set	nomacro
	jal	__extendsfdf2
	addu	$16,$16,1
	.set	macro
	.set	reorder

	move	$4,$18
	move	$5,$19
	move	$6,$2
	.set	noreorder
	.set	nomacro
	jal	__adddf3
	move	$7,$3
	.set	macro
	.set	reorder

	move	$18,$2
	move	$19,$3
	slt	$2,$16,$20
	bne	$2,$0,$L18
$L16:
	blez	$20,$L20
	.set	noreorder
	.set	nomacro
	jal	__floatsidf
	move	$4,$20
	.set	macro
	.set	reorder

	move	$4,$18
	move	$5,$19
	move	$6,$2
	.set	noreorder
	.set	nomacro
	jal	__divdf3
	move	$7,$3
	.set	macro
	.set	reorder

	j	$L21
$L20:
	move	$2,$0
	move	$3,$0
$L21:
	lw	$31,36($sp)
	lw	$20,32($sp)
	lw	$19,28($sp)
	lw	$18,24($sp)
	lw	$17,20($sp)
	lw	$16,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,40
	.set	macro
	.set	reorder

	.end	average
	.text
	.ent	scale
scale:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	li.s	$5,2.50000000000000000000e0
	subu	$sp,$sp,24
	sw	$31,16($sp)
	jal	__mulsf3
	li.s	$5,5.00000000000000000000e-1
	.set	noreorder
	.set	nomacro
	jal	__addsf3
	move	$4,$2
	.set	macro
	.set	reorder

	lw	$31,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	scale
	.text
	.ent	compare_doubles
compare_doubles:
	.frame	$sp,40,$31		# vars= 0, regs= 5/0, args= 16, extra= 0
	.mask	0x800f0000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,40
	sw	$17,20($sp)
	sw	$16,16($sp)
	move	$16,$4
	move	$17,$5
	sw	$19,28($sp)
	sw	$18,24($sp)
	move	$18,$6
	sw	$31,32($sp)
	.set	noreorder
	.set	nomacro
	jal	__ltdf2
	move	$19,$7
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	bgez	$2,$L24
	move	$4,$16
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	j	$L28
	li	$2,-1			# 0xffffffff
	.set	macro
	.set	reorder

$L24:
	move	$5,$17
	move	$6,$18
	.set	noreorder
	.set	nomacro
	jal	__gtdf2
	move	$7,$19
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	bgtz	$2,$L28
	li	$2,1			# 0x00000001
	.set	macro
	.set	reorder

	move	$4,$16
	move	$5,$17
	move	$6,$18
	.set	noreorder
	.set	nomacro
	jal	__nedf2
	move	$7,$19
	.set	macro
	.set	reorder

	sltu	$2,$0,$2
	sll	$2,$2,1
$L28:
	lw	$31,32($sp)
	lw	$19,28($sp)
	lw	$18,24($sp)
	lw	$17,20($sp)
	lw	$16,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,40
	.set	macro
	.set	reorder

	.end	compare_doubles
