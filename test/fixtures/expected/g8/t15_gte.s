	.file	1 "t15_gte.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	dot_fixed
	.align	2
	.globl	apply_rot
	.align	2
	.globl	identity
	.align	2
	.globl	transform_box
	.align	2
	.globl	scale_matrix

	.text
	.text
	.ent	dot_fixed
dot_fixed:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lh	$3,0($4)
	lh	$2,0($5)
	#nop
	mult	$3,$2
	lh	$3,2($4)
	mflo	$7
	#nop
	lh	$2,2($5)
	#nop
	mult	$3,$2
	lh	$3,4($4)
	mflo	$6
	#nop
	lh	$2,4($5)
	#nop
	mult	$3,$2
	addu	$2,$7,$6
	mflo	$3
	#nop
	#nop
	addu	$2,$2,$3
	.set	noreorder
	.set	nomacro
	j	$31
	sra	$2,$2,12
	.set	macro
	.set	reorder

	.end	dot_fixed
	.text
	.ent	apply_rot
apply_rot:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lh	$2,0($4)
	lh	$7,0($5)
	#nop
	mult	$2,$7
	lh	$3,2($5)
	mflo	$12
	#nop
	lh	$2,2($4)
	#nop
	mult	$2,$3
	lh	$8,4($5)
	mflo	$9
	#nop
	lh	$2,4($4)
	#nop
	mult	$2,$8
	mflo	$24
	#nop
	lh	$2,6($4)
	#nop
	mult	$2,$7
	mflo	$13
	#nop
	lh	$2,8($4)
	#nop
	mult	$2,$3
	mflo	$11
	#nop
	lh	$2,10($4)
	#nop
	mult	$2,$8
	mflo	$10
	#nop
	lh	$2,12($4)
	#nop
	mult	$2,$7
	mflo	$14
	#nop
	lh	$2,14($4)
	#nop
	mult	$2,$3
	lh	$5,16($4)
	addu	$2,$12,$9
	addu	$2,$2,$24
	lhu	$3,20($4)
	mflo	$7
	#nop
	sra	$2,$2,12
	addu	$3,$3,$2
	mult	$5,$8
	addu	$2,$13,$11
	addu	$2,$2,$10
	sh	$3,0($6)
	lhu	$3,24($4)
	sra	$2,$2,12
	addu	$3,$3,$2
	sh	$3,2($6)
	lhu	$3,28($4)
	sh	$0,6($6)
	addu	$2,$14,$7
	mflo	$8
	#nop
	#nop
	addu	$2,$2,$8
	sra	$2,$2,12
	addu	$3,$3,$2
	.set	noreorder
	.set	nomacro
	j	$31
	sh	$3,4($6)
	.set	macro
	.set	reorder

	.end	apply_rot
	.text
	.ent	identity
identity:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	move	$6,$0
	li	$9,4096			# 0x00001000
	move	$8,$4
	move	$7,$6
$L7:
	move	$3,$0
	move	$5,$7
$L11:
	.set	noreorder
	.set	nomacro
	bne	$6,$3,$L12
	addu	$2,$4,$5
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	j	$L10
	sh	$9,0($2)
	.set	macro
	.set	reorder

$L12:
	sh	$0,0($2)
$L10:
	addu	$3,$3,1
	slt	$2,$3,3
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L11
	addu	$5,$5,2
	.set	macro
	.set	reorder

	sw	$0,20($8)
	addu	$8,$8,4
	addu	$6,$6,1
	slt	$2,$6,3
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L7
	addu	$7,$7,6
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	j	$31
	sh	$0,18($4)
	.set	macro
	.set	reorder

	.end	identity
	.text
	.ent	transform_box
transform_box:
	.frame	$sp,48,$31		# vars= 0, regs= 7/0, args= 16, extra= 0
	.mask	0x803f0000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,48
	sw	$20,32($sp)
	move	$20,$4
	sw	$19,28($sp)
	move	$19,$0
	sw	$17,20($sp)
	move	$17,$19
	sw	$21,36($sp)
	li	$21,1			# 0x00000001
	sw	$16,16($sp)
	move	$16,$5
	sw	$18,24($sp)
	move	$18,$20
	sw	$31,40($sp)
$L20:
	addu	$4,$20,64
	move	$5,$18
	.set	noreorder
	.set	nomacro
	jal	apply_rot
	move	$6,$16
	.set	macro
	.set	reorder

	lh	$2,4($16)
	#nop
	.set	noreorder
	.set	nomacro
	bgez	$2,$L19
	sll	$2,$21,$17
	.set	macro
	.set	reorder

	or	$19,$19,$2
$L19:
	addu	$16,$16,8
	addu	$17,$17,1
	slt	$2,$17,8
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L20
	addu	$18,$18,8
	.set	macro
	.set	reorder

	move	$2,$19
	sw	$19,96($20)
	lw	$31,40($sp)
	lw	$21,36($sp)
	lw	$20,32($sp)
	lw	$19,28($sp)
	lw	$18,24($sp)
	lw	$17,20($sp)
	lw	$16,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,48
	.set	macro
	.set	reorder

	.end	transform_box
	.text
	.ent	scale_matrix
scale_matrix:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	move	$9,$0
	sll	$5,$5,16
	sra	$5,$5,16
	move	$8,$9
$L27:
	move	$7,$0
	move	$6,$8
$L31:
	addu	$3,$4,$6
	lh	$2,0($3)
	#nop
	mult	$2,$5
	addu	$7,$7,1
	mflo	$10
	#nop
	#nop
	sra	$2,$10,12
	sh	$2,0($3)
	slt	$2,$7,3
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L31
	addu	$6,$6,2
	.set	macro
	.set	reorder

	addu	$9,$9,1
	slt	$2,$9,3
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L27
	addu	$8,$8,6
	.set	macro
	.set	reorder

	j	$31
	.end	scale_matrix
