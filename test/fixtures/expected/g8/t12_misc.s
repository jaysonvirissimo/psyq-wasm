	.file	1 "t12_misc.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	dot
	.align	2
	.globl	fixed_mul
	.align	2
	.globl	abs_
	.align	2
	.globl	clamp
	.align	2
	.globl	pack
	.align	2
	.globl	bits
	.align	2
	.globl	nested
	.align	2
	.globl	memcpy_like
	.align	2
	.globl	ternary_chain

	.text
	.text
	.ent	dot
dot:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lw	$3,0($4)
	lw	$2,0($5)
	#nop
	mult	$3,$2
	lw	$3,4($4)
	mflo	$7
	#nop
	lw	$2,4($5)
	#nop
	mult	$3,$2
	lw	$3,8($4)
	mflo	$6
	#nop
	lw	$2,8($5)
	#nop
	mult	$3,$2
	addu	$2,$7,$6
	mflo	$3
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$2,$3
	.set	macro
	.set	reorder

	.end	dot
	.text
	.ent	fixed_mul
fixed_mul:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	mult	$4,$5
	mflo	$3
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	sra	$2,$3,12
	.set	macro
	.set	reorder

	.end	fixed_mul
	.text
	.ent	abs_
abs_:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	move	$2,$4
	bgez	$2,$L5
	subu	$2,$0,$2
$L5:
	j	$31
	.end	abs_
	.text
	.ent	clamp
clamp:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	slt	$2,$4,$5
	.set	noreorder
	.set	nomacro
	beq	$2,$0,$L9
	slt	$2,$6,$4
	.set	macro
	.set	reorder

	move	$4,$5
	slt	$2,$6,$4
$L9:
	beq	$2,$0,$L8
	move	$4,$6
$L8:
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$4
	.set	macro
	.set	reorder

	.end	clamp
	.text
	.ent	pack
pack:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	andi	$2,$4,0x00ff
	andi	$5,$5,0x00ff
	sll	$5,$5,8
	or	$2,$2,$5
	andi	$6,$6,0x00ff
	sll	$6,$6,16
	.set	noreorder
	.set	nomacro
	j	$31
	or	$2,$2,$6
	.set	macro
	.set	reorder

	.end	pack
	.text
	.ent	bits
bits:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	beq	$4,$0,$L13
	move	$3,$0
	.set	macro
	.set	reorder

$L14:
	andi	$2,$4,0x0001
	srl	$4,$4,1
	.set	noreorder
	.set	nomacro
	bne	$4,$0,$L14
	addu	$3,$3,$2
	.set	macro
	.set	reorder

$L13:
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$3
	.set	macro
	.set	reorder

	.end	bits
	.text
	.ent	nested
nested:
	.frame	$sp,40,$31		# vars= 0, regs= 6/0, args= 16, extra= 0
	.mask	0x801f0000,-4
	.fmask	0x00000000,0
	subu	$sp,$sp,40
	sw	$20,32($sp)
	move	$20,$4
	sw	$19,28($sp)
	move	$19,$5
	sw	$17,20($sp)
	move	$17,$0
	sw	$18,24($sp)
	move	$18,$17
	sw	$31,36($sp)
	.set	noreorder
	.set	nomacro
	blez	$20,$L18
	sw	$16,16($sp)
	.set	macro
	.set	reorder

$L20:
	.set	noreorder
	.set	nomacro
	blez	$19,$L19
	move	$16,$0
	.set	macro
	.set	reorder

	move	$4,$17
$L27:
	.set	noreorder
	.set	nomacro
	jal	ext2
	move	$5,$16
	.set	macro
	.set	reorder

	addu	$18,$18,$2
	addu	$16,$16,1
	slt	$2,$16,$19
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L27
	move	$4,$17
	.set	macro
	.set	reorder

$L19:
	addu	$17,$17,1
	slt	$2,$17,$20
	bne	$2,$0,$L20
$L18:
	move	$2,$18
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

	.end	nested
	.text
	.ent	memcpy_like
memcpy_like:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	move	$2,$6
	.set	noreorder
	.set	nomacro
	blez	$2,$L33
	addu	$6,$6,-1
	.set	macro
	.set	reorder

$L31:
	lbu	$2,0($5)
	addu	$5,$5,1
	move	$3,$6
	addu	$6,$6,-1
	sb	$2,0($4)
	.set	noreorder
	.set	nomacro
	bgtz	$3,$L31
	addu	$4,$4,1
	.set	macro
	.set	reorder

$L33:
	j	$31
	.end	memcpy_like
	.text
	.ent	ternary_chain
ternary_chain:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li	$2,1			# 0x00000001
	.set	noreorder
	.set	nomacro
	beq	$4,$2,$L35
	li	$2,2			# 0x00000002
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	beq	$4,$2,$L37
	li	$2,3			# 0x00000003
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	bne	$4,$2,$L36
	move	$3,$0
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	j	$L36
	li	$3,30			# 0x0000001e
	.set	macro
	.set	reorder

$L37:
	.set	noreorder
	.set	nomacro
	j	$L36
	li	$3,20			# 0x00000014
	.set	macro
	.set	reorder

$L35:
	li	$3,10			# 0x0000000a
$L36:
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$3
	.set	macro
	.set	reorder

	.end	ternary_chain
