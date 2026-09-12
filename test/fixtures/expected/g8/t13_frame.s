	.file	1 "t13_frame.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	rations_fill
	.align	2
	.globl	rations_sum
	.align	2
	.globl	two_frames

	.text
	.text
	.ent	rations_fill
rations_fill:
	.frame	$sp,36024,$31		# vars= 36000, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	li	$12,36024			# 0x00008cb8
	subu	$sp,$sp,$12
	addu	$13,$12,$sp
	sw	$31,-8($13)
	li	$3,8999			# 0x00002327
	li	$2,36012			# 0x00008cac
	addu	$2,$sp,$2
	addu	$4,$4,$3
$L5:
	sw	$4,0($2)
	addu	$2,$2,-4
	addu	$3,$3,-1
	.set	noreorder
	.set	nomacro
	bgez	$3,$L5
	addu	$4,$4,-1
	.set	macro
	.set	reorder

	addu	$4,$sp,16
	.set	noreorder
	.set	nomacro
	jal	mess_hall
	li	$5,9000			# 0x00002328
	.set	macro
	.set	reorder

	li	$12,36024			# 0x00008cb8
	addu	$13,$12,$sp
	lw	$31,-8($13)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,$12
	.set	macro
	.set	reorder

	.end	rations_fill
	.text
	.ent	rations_sum
rations_sum:
	.frame	$sp,36000,$31		# vars= 36000, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li	$12,36000			# 0x00008ca0
	subu	$sp,$sp,$12
	move	$9,$0
	move	$5,$9
	move	$3,$sp
$L11:
	xor	$2,$4,$5
	andi	$2,$2,0x00ff
	sw	$2,0($3)
	addu	$5,$5,1
	slt	$2,$5,9000
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L11
	addu	$3,$3,4
	.set	macro
	.set	reorder

	move	$5,$0
	li	$8,8			# 0x00000008
	move	$7,$sp
	li	$6,4			# 0x00000004
$L16:
	addu	$4,$sp,$8
	addu	$8,$8,12
	lw	$2,0($7)
	addu	$7,$7,12
	addu	$3,$sp,$6
	addu	$5,$5,3
	lw	$3,0($3)
	lw	$4,0($4)
	subu	$2,$2,$3
	addu	$2,$2,$4
	addu	$9,$9,$2
	slt	$2,$5,9000
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L16
	addu	$6,$6,12
	.set	macro
	.set	reorder

	move	$2,$9
	li	$12,36000			# 0x00008ca0
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,$12
	.set	macro
	.set	reorder

	.end	rations_sum
	.text
	.ent	two_frames
two_frames:
	.frame	$sp,32824,$31		# vars= 32800, regs= 2/0, args= 16, extra= 0
	.mask	0x80010000,-4
	.fmask	0x00000000,0
	li	$12,32824			# 0x00008038
	subu	$sp,$sp,$12
	addu	$13,$12,$sp
	move	$2,$5
	sw	$31,-4($13)
	sw	$16,-8($13)
	sw	$4,16($sp)
	addu	$4,$sp,16
	li	$3,32768			# 0x00008000
	addu	$3,$4,$3
	sw	$2,28($3)
	lw	$3,16($sp)
	li	$5,1			# 0x00000001
	addu	$2,$2,$3
	sw	$2,16412($sp)
	sll	$2,$2,$5
	.set	noreorder
	.set	nomacro
	jal	mess_hall
	sw	$2,16416($sp)
	.set	macro
	.set	reorder

	addu	$4,$sp,16416
	li	$5,2			# 0x00000002
	.set	noreorder
	.set	nomacro
	jal	mess_hall
	move	$16,$2
	.set	macro
	.set	reorder

	li	$12,32824			# 0x00008038
	addu	$13,$12,$sp
	lw	$3,16412($sp)
	lw	$4,16416($sp)
	lw	$31,-4($13)
	addu	$3,$3,$4
	addu	$3,$3,$16
	lw	$16,-8($13)
	addu	$2,$3,$2
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,$12
	.set	macro
	.set	reorder

	.end	two_frames
